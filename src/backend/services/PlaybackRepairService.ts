import path from 'path';
import { inject, injectable } from 'inversify';
import {
    FolderVideos,
    Mp3BitrateMode,
    PlaybackRepairDiagnosis,
    PlaybackRepairStartResult,
    RepairRecipe,
    RunningRepair,
} from '@/common/contracts/playback-repair';
import MediaUtil from '@/common/utils/MediaUtil';
import { CancelByUserError } from '@/backend/utils/errors/errors';
import { detectMp3BitrateMode } from '@/backend/utils/mp3-bitrate-mode';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import DpTaskService from '@/backend/services/DpTaskService';
import FfmpegService from '@/backend/services/FfmpegService';
import TYPES from '@/backend/ioc/types';
import { decideRepair, isCopyableAudioCodec, isCopyableVideoCodec, PlaybackFacts } from '@/backend/services/playback-repair-rules';
import { getHtml5VariantPath, getRepairTempPath, isHtml5VariantFileName } from '@/backend/services/watch-history-file-rules';
import { getMainLogger } from '@/backend/infrastructure/logger';
import PlaybackCapabilityService from '@/backend/services/PlaybackCapabilityService';

/** 判定 MP3 码率模式需要读取的文件头部字节数；约覆盖 200 帧。 */
const MP3_HEADER_BYTES = 128 * 1024;

/**
 * 文件夹扫描中仅凭扩展名即可判定需要修复的容器。
 *
 * 其他容器（mp4/mov/webm）是否需要修复取决于内部编码，逐个 ffprobe 会让大目录扫描变得很慢，
 * 因此扫描阶段不处理它们，交给用户打开文件时的单文件诊断。
 */
const ALWAYS_REPAIRABLE_EXTENSIONS = new Set(['.mkv', '.avi', '.wmv', '.flv']);

/**
 * 修复产物路径。
 */
interface RepairOutputPaths {
    /** 修复产物文件路径。 */
    outputPath: string;
    /** 从产物中提取的字幕路径；仅视频产物会产生。 */
    subtitlePath: string;
}

/**
 * 一次正在进行的修复。
 *
 * 实例先构造、再登记进运行表，因此「诊断还没返回时第二次发起」也能命同一条修复。
 */
class RunningRepairEntry {
    /** 后台任务编号；诊断完成、任务创建之前为 `null`。 */
    public taskId: number | null = null;

    /** 启动结果；同一媒体重复发起时直接复用这次修复。 */
    public readonly started: Promise<PlaybackRepairStartResult>;

    /**
     * 创建运行中的修复记录并立即开始诊断。
     *
     * @param filePath 待修复的源媒体绝对路径。
     * @param outputPath 修复产物绝对路径。
     * @param start 启动函数；由外部传入服务实例的回调，避开构造期循环引用。
     */
    constructor(
        public readonly filePath: string,
        public readonly outputPath: string,
        start: (entry: RunningRepairEntry) => Promise<PlaybackRepairStartResult>,
    ) {
        this.started = start(this);
    }
}

/**
 * 播放修复的业务契约：诊断媒体在当前播放器上会不会出问题，并按配方生成修复产物。
 */
export default interface PlaybackRepairService {
    /**
     * 诊断媒体文件在当前播放器上是否需要修复。
     *
     * @param filePath 媒体或修复产物绝对路径。
     * @returns 诊断结论；已存在产物或可直接播放时 `needsRepair` 为 `false`。
     * @throws 文件不存在、为空或无法探测媒体流时直接抛错，不用兜底结论掩盖。
     */
    diagnose(filePath: string): Promise<PlaybackRepairDiagnosis>;

    /**
     * 诊断并启动修复任务。
     *
     * @param filePath 待修复媒体绝对路径。
     * @returns 任务编号与诊断结论；无需修复时任务编号为 `null`（调用方据此提示用户）。
     */
    startRepair(filePath: string): Promise<PlaybackRepairStartResult>;

    /**
     * 列出正在运行的修复任务。
     *
     * 供修复页面打开时接管从播放页发起的修复，避免两个入口各维护一份队列。
     *
     * @returns 正在修复的媒体；诊断尚未完成、还未创建任务的不包含在内。
     */
    listRunningRepairs(): RunningRepair[];

    /**
     * 扫描文件夹并返回尚未生成修复产物的媒体文件。
     *
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的待修复媒体集合。
     */
    listRepairableVideos(folders: string[]): Promise<FolderVideos[]>;

    /**
     * 丢弃某个媒体的修复产物。
     *
     * 用于修复产物在真机试播验收中仍不可播的场景：产物留着会被后续播放优先选中，
     * 因此必须删掉并回到原始文件。
     *
     * @param filePath 原媒体或产物绝对路径。
     * @returns 产物存在并被删除时返回 `true`；产物不存在时返回 `false`。
     * @throws 传入路径不是修复产物命名时直接抛错，避免误删源文件。
     */
    discardRepairOutput(filePath: string): Promise<boolean>;
}

/**
 * 负责播放修复用例的完整业务流程。
 *
 * Controller 只调用此服务；诊断规则、任务状态、产物路径和 FFmpeg 调用均在这里统一编排。
 */
@injectable()
export class PlaybackRepairServiceImpl implements PlaybackRepairService {
    private logger = getMainLogger('PlaybackRepairService');

    /**
     * 正在修复的产物路径到运行记录。
     *
     * 修复产物固定写在源文件旁边，同一文件的两次修复会写到同一份临时文件上，
     * 因此从播放页与修复页两个入口同时发起时必须合并成同一次修复。守护放在服务层，
     * 因为两个入口调用的是同一个 IPC 路由，而修复任务只存活在当前主进程内
     * （进程重启时 DpTaskService 会把活动任务标为已取消）。
     */
    private readonly runningRepairs = new Map<string, RunningRepairEntry>();

    /**
     * 创建播放修复用例服务。
     * @param dpTaskService 后台任务状态服务。
     * @param ffmpegService FFmpeg 基础能力服务。
     * @param storageDirectoryProvider 外部路径权限恢复服务。
     * @param fileSystemGateway 文件系统访问入口。
     * @param playbackCapabilityService 播放能力学习缓存，提供本机实测的编码结论。
     */
    constructor(
        @inject(TYPES.DpTaskService) private readonly dpTaskService: DpTaskService,
        @inject(TYPES.FfmpegService) private readonly ffmpegService: FfmpegService,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) private readonly fileSystemGateway: FileSystemGateway,
        @inject(TYPES.PlaybackCapabilityService) private readonly playbackCapabilityService: PlaybackCapabilityService,
    ) {}

    /**
     * 诊断媒体文件在当前播放器上是否需要修复。
     *
     * @param filePath 媒体或修复产物绝对路径。
     * @returns 诊断结论。
     * @throws 文件不存在、为空或无法探测媒体流时直接抛错。
     */
    public async diagnose(filePath: string): Promise<PlaybackRepairDiagnosis> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        // 传入的已经是产物时直接按「已修复」返回，避免为产物再算一层产物路径。
        if (isHtml5VariantFileName(path.basename(filePath))) {
            return {
                filePath,
                needsRepair: false,
                reason: 'already-repaired',
                outputPath: filePath,
                hasVideoStream: !MediaUtil.isAudio(filePath),
                hasAudioStream: true,
            };
        }

        await this.assertRepairableSource(filePath);
        const outputPath = this.buildOutputPaths(filePath).outputPath;
        if (await this.hasNonEmptyFile(outputPath)) {
            return {
                filePath,
                needsRepair: false,
                reason: 'already-repaired',
                outputPath,
                hasVideoStream: !MediaUtil.isAudio(filePath),
                hasAudioStream: true,
            };
        }

        const facts = await this.collectFacts(filePath);
        // 叠加本机实测的学习结论：静态白名单有跨平台误判的可能（如无硬解机器上的 HEVC），
        // 实测「不可解」的编码会让配方收紧到重编码。
        const learned = await this.playbackCapabilityService.getOverlay(facts.videoCodec, facts.audioCodec);
        const decision = decideRepair(facts, learned);
        return {
            filePath,
            needsRepair: decision.needsRepair,
            reason: decision.reason,
            recipe: decision.recipe,
            outputPath: decision.needsRepair ? outputPath : undefined,
            videoCodec: facts.videoCodec,
            audioCodec: facts.audioCodec,
            hasVideoStream: facts.hasVideoStream,
            hasAudioStream: facts.hasAudioStream,
            mp3BitrateMode: facts.mp3BitrateMode,
        };
    }

    /**
     * 诊断并启动修复任务。
     *
     * 同一媒体的修复已在运行时不再重复创建任务，而是返回正在运行的任务编号，
     * 调用方（播放页、修复页）接管同一条进度，避免两个 ffmpeg 写同一份产物。
     * 占位在方法内同步登记，因此即使两个入口几乎同时发起也只会启动一次。
     *
     * @param filePath 待修复媒体绝对路径。
     * @returns 任务编号与诊断结论；无需修复时任务编号为 `null`。
     */
    public startRepair(filePath: string): Promise<PlaybackRepairStartResult> {
        const outputPath = getHtml5VariantPath(filePath);
        const running = this.runningRepairs.get(outputPath);
        if (running) {
            this.logger.info('reuse running repair', { filePath, outputPath });
            return running.started;
        }

        const entry = new RunningRepairEntry(filePath, outputPath, (self) => this.beginRepair(self));
        this.runningRepairs.set(outputPath, entry);
        return entry.started;
    }

    /**
     * 列出正在运行的修复任务。
     *
     * @returns 正在修复的媒体；诊断尚未完成、任务还没创建的不包含在内。
     */
    public listRunningRepairs(): RunningRepair[] {
        const running: RunningRepair[] = [];
        for (const entry of this.runningRepairs.values()) {
            if (entry.taskId !== null) {
                running.push({
                    taskId: entry.taskId,
                    filePath: entry.filePath,
                    outputPath: entry.outputPath,
                });
            }
        }
        return running;
    }

    /**
     * 执行诊断并创建修复任务；无论成功失败都会释放占位。
     *
     * @param entry 运行中的修复记录。
     * @returns 任务编号与诊断结论。
     */
    private async beginRepair(entry: RunningRepairEntry): Promise<PlaybackRepairStartResult> {
        const { filePath, outputPath } = entry;
        try {
            const diagnosis = await this.diagnose(filePath);
            if (!diagnosis.needsRepair) {
                this.runningRepairs.delete(outputPath);
                return { taskId: null, diagnosis };
            }

            const taskId = await this.dpTaskService.create();
            entry.taskId = taskId;
            void this.executeRepair(taskId, filePath, diagnosis)
                .catch((error: unknown) => {
                    // executeRepair 自己只处理修复过程中的异常，这里兜住它启动前的早期失败。
                    this.logger.error('repair task crashed', { taskId, filePath, error });
                    this.dpTaskService.fail(taskId, {
                        progress: `修复失败：${error instanceof Error ? error.message : String(error)}`,
                        result: JSON.stringify({ progress: 0, path: outputPath }),
                    });
                })
                .finally(() => this.runningRepairs.delete(outputPath));
            return { taskId, diagnosis };
        } catch (error) {
            this.runningRepairs.delete(outputPath);
            throw error;
        }
    }

    /**
     * 扫描文件夹并返回尚未生成修复产物的媒体文件。
     *
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的待修复媒体集合。
     */
    public async listRepairableVideos(folders: string[]): Promise<FolderVideos[]> {
        const result: FolderVideos[] = [];
        for (const folder of folders) {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folder);
            const fileNames = await this.fileSystemGateway.listFileNames(folder);
            const videos: string[] = [];

            for (const fileName of fileNames) {
                const extension = path.extname(fileName).toLowerCase();
                if (!ALWAYS_REPAIRABLE_EXTENSIONS.has(extension) && extension !== '.mp3') {
                    continue;
                }

                const videoPath = path.join(folder, fileName);
                if (await this.hasNonEmptyFile(this.buildOutputPaths(videoPath).outputPath)) {
                    continue;
                }
                // 定长码率的 MP3 可以直接播放，扫描阶段只读文件头判定，不做逐个 ffprobe。
                if (extension === '.mp3' && await this.detectBitrateMode(videoPath) === 'cbr') {
                    continue;
                }
                videos.push(videoPath);
            }

            result.push({ folder, videos });
        }
        return result;
    }

    /**
     * 丢弃某个媒体的修复产物。
     *
     * @param filePath 原媒体或产物绝对路径。
     * @returns 产物存在并被删除时返回 `true`。
     * @throws 传入路径不是修复产物命名时直接抛错，避免误删源文件。
     */
    public async discardRepairOutput(filePath: string): Promise<boolean> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        if (!isHtml5VariantFileName(path.basename(filePath))) {
            throw new Error(`拒绝删除非修复产物：${filePath}`);
        }
        // 写入过程中的临时产物一并清理：只删正式产物名会留下 `.part` 残留文件。
        await this.fileSystemGateway.removeFileIfExists(getRepairTempPath(filePath));
        if (!await this.fileSystemGateway.fileExists(filePath)) {
            return false;
        }
        await this.fileSystemGateway.removeFileIfExists(filePath);
        return true;
    }

    /**
     * 收集诊断所需的事实：MP3 码率模式与容器内的编码信息。
     *
     * @param filePath 媒体绝对路径。
     * @returns 判定事实；音频文件不探测视频流。
     */
    private async collectFacts(filePath: string): Promise<PlaybackFacts> {
        const fileName = path.basename(filePath);
        const mp3BitrateMode = path.extname(fileName).toLowerCase() === '.mp3'
            ? await this.detectBitrateMode(filePath)
            : undefined;
        if (MediaUtil.isAudio(fileName)) {
            return { fileName, hasVideoStream: false, hasAudioStream: true, mp3BitrateMode };
        }

        const info = await this.ffmpegService.getVideoInfo(filePath);
        return {
            fileName,
            hasVideoStream: typeof info.videoCodec === 'string' && info.videoCodec.length > 0,
            hasAudioStream: typeof info.audioCodec === 'string' && info.audioCodec.length > 0,
            videoCodec: info.videoCodec,
            audioCodec: info.audioCodec,
            mp3BitrateMode,
        };
    }

    /**
     * 读取文件头部并判定 MP3 码率模式。
     *
     * @param filePath MP3 绝对路径。
     * @returns 码率模式；无法判定时返回 `unknown`（上层按需要修复处理）。
     */
    private async detectBitrateMode(filePath: string): Promise<Mp3BitrateMode> {
        const header = await this.fileSystemGateway.readBinaryFileSlice(filePath, MP3_HEADER_BYTES);
        return detectMp3BitrateMode(header);
    }

    /**
     * 校验待修复媒体存在且非空，避免把问题推到 ffmpeg 深处。
     *
     * @param inputFile 待修复媒体绝对路径。
     */
    private async assertRepairableSource(inputFile: string): Promise<void> {
        if (!await this.fileSystemGateway.fileExists(inputFile)) {
            throw new Error(`待修复的媒体文件不存在：${inputFile}`);
        }
        if (await this.fileSystemGateway.getFileSize(inputFile) === 0) {
            throw new Error(`待修复的媒体文件为空：${inputFile}`);
        }
    }

    /**
     * 执行修复任务并保证后台异常会落到明确的任务状态。
     *
     * @param taskId 修复任务 ID。
     * @param inputFile 待修复媒体绝对路径。
     * @param diagnosis 已确认需要修复的诊断结论。
     */
    private async executeRepair(
        taskId: number,
        inputFile: string,
        diagnosis: PlaybackRepairDiagnosis,
    ): Promise<void> {
        const recipe = diagnosis.recipe;
        const outputPath = diagnosis.outputPath;
        if (!recipe || !outputPath) {
            throw new Error(`修复诊断缺少配方或产物路径：${diagnosis.filePath}`);
        }
        const subtitlePath = this.buildOutputPaths(inputFile).subtitlePath;
        // 任务中心要求每次进度更新都携带输出路径，供渲染端持续展示修复结果。
        const updateProgress = (progress: number): void => {
            this.dpTaskService.process(taskId, {
                progress: '正在修复',
                result: JSON.stringify({ progress, path: outputPath }),
            });
        };

        try {
            updateProgress(0);
            await this.repairMedia(taskId, inputFile, outputPath, recipe, diagnosis, updateProgress);
            // 纯音频修复不会产出字幕；视频修复沿用既有行为，把内嵌文本字幕抽成同名 srt。
            const subtitleExtracted = recipe === 'audio-transcode'
                ? false
                : await this.extractSubtitleIfNeeded(taskId, inputFile, subtitlePath, updateProgress);
            this.dpTaskService.finish(taskId, {
                progress: subtitleExtracted ? '修复完成' : '修复完成，未提取到字幕',
                result: JSON.stringify({ progress: 100, path: outputPath }),
            });
        } catch (error) {
            if (this.confirmUserCancellation(taskId, error)) {
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            this.dpTaskService.fail(taskId, {
                progress: `修复失败：${message}`,
                result: JSON.stringify({ progress: 0, path: outputPath }),
            });
        }
    }

    /**
     * 执行修复命令并验收产物；任一步失败都清理产物，避免留下半成品或不可播文件。
     *
     * 产物先写入临时名，验收通过后才改名为正式产物名：正式产物名一旦出现就会被
     * 「有修复产物就优先用产物」的播放与元数据探测逻辑选中，而写到一半的 mp4 系容器
     * 无法解析，会让正在播放的媒体与观看历史列表一起报错。
     *
     * @param taskId 修复任务 ID。
     * @param inputFile 待修复媒体绝对路径。
     * @param outputFile 修复产物路径。
     * @param recipe 修复配方。
     * @param diagnosis 本次诊断结论，提供源文件流信息。
     * @param onProgress FFmpeg 进度回调。
     */
    private async repairMedia(
        taskId: number,
        inputFile: string,
        outputFile: string,
        recipe: RepairRecipe,
        diagnosis: PlaybackRepairDiagnosis,
        onProgress: (progress: number) => void,
    ): Promise<void> {
        const tempPath = getRepairTempPath(outputFile);
        // 上一轮异常退出可能留下临时文件，先清掉，避免 ffmpeg 接着旧内容写。
        await this.fileSystemGateway.removeFileIfExists(tempPath);
        let published = false;
        try {
            await this.ffmpegService.repair({
                taskId,
                inputFile,
                outputFile: tempPath,
                recipe,
                onProgress,
            });

            if (!await this.hasNonEmptyFile(tempPath)) {
                throw new Error(`修复未生成有效文件：${outputFile}`);
            }

            await this.verifyRepairedMedia(inputFile, tempPath, diagnosis);
            // 通过校验后才用正式产物名发布：写在中途的产物不能被播放与探测看见。
            await this.fileSystemGateway.moveFile(tempPath, outputFile);
            published = true;
        } catch (error) {
            await this.fileSystemGateway.removeFileIfExists(tempPath);
            if (published) {
                await this.fileSystemGateway.removeFileIfExists(outputFile);
            }
            throw error;
        }
    }

    /**
     * 验收修复产物确实能正常播放，不通过则抛错（由调用方删除产物并标记任务失败）。
     *
     * 判定依据是当前播放器实测的能力，而不是「ffmpeg 退出码为 0」：
     * - 产物能被探测出流信息，且时长有效；
     * - 源文件有的流，产物必须也有；
     * - 留在产物里的视频/音频编码必须是播放器能解的类型；
     * - 视频源额外比对时长，避免产物被截断。
     *
     * 音频源不比对时长：无索引的 VBR 音频连 ffprobe 的时长也只能估算，比了会误判。
     *
     * @param inputFile 源媒体绝对路径。
     * @param outputPath 修复产物绝对路径。
     * @param diagnosis 本次诊断结论。
     */
    private async verifyRepairedMedia(
        inputFile: string,
        outputPath: string,
        diagnosis: PlaybackRepairDiagnosis,
    ): Promise<void> {
        const output = await this.ffmpegService.getVideoInfo(outputPath);
        if (!(output.duration > 0)) {
            throw new Error('修复产物的时长为 0，无法播放');
        }
        if (diagnosis.hasVideoStream && !output.videoCodec) {
            throw new Error('修复产物缺少视频流');
        }
        if (diagnosis.hasAudioStream && !output.audioCodec) {
            throw new Error('修复产物缺少音轨');
        }
        if (output.videoCodec && !isCopyableVideoCodec(output.videoCodec)) {
            throw new Error(`修复产物的视频编码仍不受播放器支持：${output.videoCodec}`);
        }
        if (output.audioCodec && !isCopyableAudioCodec(output.audioCodec)) {
            throw new Error(`修复产物的音频编码仍不受播放器支持：${output.audioCodec}`);
        }
        if (!diagnosis.hasVideoStream) {
            return;
        }

        const source = await this.ffmpegService.getVideoInfo(inputFile);
        const tolerance = Math.max(3, source.duration * 0.01);
        if (source.duration > 0 && Math.abs(source.duration - output.duration) > tolerance) {
            throw new Error(
                `修复产物时长异常：源 ${source.duration.toFixed(1)}s，产物 ${output.duration.toFixed(1)}s`,
            );
        }
    }

    /**
     * 提取字幕；无文本字幕或提取结果为空时返回 false，不影响修复结果。
     *
     * 字幕流选择（优先英语、回退第一条文本字幕）由 FFmpeg 服务层一次性完成，
     * 不再采用“跑失败再重试下一条轨道”的猜测式两段回退。
     * 用户取消必须继续向上抛出，由任务流程标记为已取消。
     *
     * @param taskId 修复任务 ID。
     * @param inputFile 待修复媒体绝对路径。
     * @param subtitleFile 字幕输出路径。
     * @param onProgress FFmpeg 进度回调。
     * @returns 成功生成非空字幕文件时返回 `true`。
     */
    private async extractSubtitleIfNeeded(
        taskId: number,
        inputFile: string,
        subtitleFile: string,
        onProgress: (progress: number) => void,
    ): Promise<boolean> {
        if (await this.hasNonEmptyFile(subtitleFile)) {
            return true;
        }

        const tempPath = getRepairTempPath(subtitleFile);
        try {
            await this.fileSystemGateway.removeFileIfExists(tempPath);
            const extracted = await this.ffmpegService.extractSubtitles({
                taskId,
                inputFile,
                outputFile: tempPath,
                onProgress,
            });

            if (extracted && await this.hasNonEmptyFile(tempPath)) {
                // 同样先写临时名再改名，避免播放时的字幕匹配读到写了一半的字幕。
                await this.fileSystemGateway.moveFile(tempPath, subtitleFile);
                return true;
            }

            await this.fileSystemGateway.removeFileIfExists(tempPath);
            return false;
        } catch (error) {
            await this.fileSystemGateway.removeFileIfExists(tempPath);
            if (error instanceof CancelByUserError) {
                throw error;
            }
            return false;
        }
    }

    /**
     * 判断路径是否指向非空文件。
     * @param filePath 文件绝对路径。
     * @returns 文件存在且大小大于零时返回 `true`。
     */
    private async hasNonEmptyFile(filePath: string): Promise<boolean> {
        if (!await this.fileSystemGateway.fileExists(filePath)) {
            return false;
        }
        return await this.fileSystemGateway.getFileSize(filePath) > 0;
    }

    /**
     * 确认异常是否来自当前任务的用户取消请求。
     * @param taskId 修复任务 ID。
     * @param error 修复流程捕获的异常。
     * @returns 任务已被标记为取消时返回 `true`。
     */
    private confirmUserCancellation(taskId: number, error: unknown): boolean {
        if (!(error instanceof CancelByUserError)) {
            return false;
        }

        try {
            this.dpTaskService.checkCancel(taskId);
        } catch (cancelError) {
            if (cancelError instanceof CancelByUserError) {
                return true;
            }
        }
        return false;
    }

    /**
     * 根据输入媒体生成固定的产物路径。
     * @param inputFile 输入媒体绝对路径。
     * @returns 修复产物与字幕输出路径。
     */
    private buildOutputPaths(inputFile: string): RepairOutputPaths {
        const outputPath = getHtml5VariantPath(inputFile);
        const parsed = path.parse(outputPath);
        return {
            outputPath,
            subtitlePath: path.join(parsed.dir, `${parsed.name}.srt`),
        };
    }
}
