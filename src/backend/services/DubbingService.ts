import { randomUUID } from 'crypto';
import path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import {
    DubbingLibraryEntry,
    DubbingManifest,
    DubbingTake,
    DubbingTakeVO,
} from '@/common/contracts/dubbing';
import FfmpegService from '@/backend/services/FfmpegService';
import SubtitleService from '@/backend/services/SubtitleService';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';

/**
 * 配音业务服务。
 *
 * 存储布局：媒体库 `dubbing/<videoKey>/` 目录下，
 * 每句只留一份录音，存为 `<句序号>-<takeId>.wav`（掐头去尾后的 48kHz 单声道 PCM），
 * 清单持久化在 `dubbing.json`；删除整个目录即清空该视频的配音。
 */
export default interface DubbingService {
    /**
     * 保存该句的录音：掐头去尾静音转 WAV、记录时长；同一句已有录音则覆盖（先删掉旧文件）。
     *
     * @param params.videoPath 录音时正在播放的视频绝对路径，记入清单供导出页定位。
     * @param params.subtitlePath 录音时绑定的字幕文件绝对路径；转录会话期间可能为空。
     * @returns 录音信息（含文件绝对路径，供前端回放）。
     */
    saveTake(params: {
        videoKey: string;
        sentenceIndex: number;
        audio: Uint8Array;
        videoPath: string;
        subtitlePath: string | null;
    }): Promise<DubbingTakeVO>;

    /**
     * 读取视频配音清单；从未录过音时返回 null。
     */
    list(videoKey: string): Promise<DubbingManifest | null>;

    /**
     * 列出所有可导出的配音记录：视频文件仍存在且已录过音的视频。
     *
     * 视频被删或移走的条目会被跳过（属正常状态），按最近录音时间倒序返回。
     */
    listLibrary(): Promise<DubbingLibraryEntry[]>;

    /**
     * 清除某句的配音。
     */
    clearSentence(params: { videoKey: string; sentenceIndex: number }): Promise<void>;

    /**
     * 清除整个视频的配音（删除该视频的配音目录）。
     */
    clearVideo(videoKey: string): Promise<void>;

    /**
     * 导出配音视频：已配音句子的音频替换为该句录音（超长自动变速对齐句长），其余保留原声。
     *
     * 视频与字幕路径从配音清单读取，每句时间区间由字幕（含时间轴微调）重新推导。
     *
     * @param params.outputFolder 导出目标文件夹。
     * @returns 导出产物绝对路径。
     */
    exportDubbedVideo(params: {
        videoKey: string;
        outputFolder: string;
    }): Promise<string>;
}

/**
 * videoKey 直接拼进文件路径，必须先验证为安全字符集。
 */
const VIDEO_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * 空录音判定阈值：掐头去尾后短于 0.1s 视为没录到声音。
 */
const MIN_TAKE_DURATION_SECOND = 0.1;

/**
 * 配音业务服务实现。
 */
@injectable()
export class DubbingServiceImpl implements DubbingService {
    private readonly logger = getMainLogger('DubbingServiceImpl');

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    /** 是否已有导出任务在执行；同一时间只允许一个导出。 */
    private exporting = false;

    public async saveTake(params: {
        videoKey: string;
        sentenceIndex: number;
        audio: Uint8Array;
        videoPath: string;
        subtitlePath: string | null;
    }): Promise<DubbingTakeVO> {
        const { folder, videoKey } = await this.resolveVideoFolder(params.videoKey);
        const takeId = randomUUID();
        const rawFile = path.join(folder, `${takeId}.webm`);
        const wavFile = path.join(folder, `${params.sentenceIndex}-${takeId}.wav`);
        const job = `dubbing-take:${videoKey}:${params.sentenceIndex}`;

        await this.fileSystemGateway.ensureDirectory(folder);
        await this.fileSystemGateway.writeBinaryFile(rawFile, params.audio);
        try {
            try {
                await this.ffmpegService.processRecording({ inputFile: rawFile, outputFile: wavFile, job });
            } catch (error) {
                // 全静音录音经 silenceremove 后没有可写样本，ffmpeg 以非零退出且不产出文件；
                // 这类失败翻译成业务语义，其余原样透出
                if (!(await this.fileSystemGateway.fileExists(wavFile))) {
                    throw new Error('录音内容为空，没有检测到声音');
                }
                throw error;
            }

            let durationSec: number;
            try {
                durationSec = await this.ffmpegService.duration(wavFile);
            } catch {
                throw new Error('录音内容为空，没有检测到声音');
            }
            if (durationSec < MIN_TAKE_DURATION_SECOND) {
                throw new Error('录音内容为空，没有检测到声音');
            }

            const take: DubbingTake = {
                id: takeId,
                fileName: path.basename(wavFile),
                durationSec: Math.round(durationSec * 1000) / 1000,
                createdAt: Date.now(),
            };
            const manifest = await this.readManifest(videoKey);
            // 记录来源视频与字幕，供导出页定位并重新推导时间区间；视频切换后重录会刷新为最新来源
            manifest.videoPath = params.videoPath;
            manifest.subtitlePath = params.subtitlePath;
            const previous = manifest.sentences[String(params.sentenceIndex)];
            // 每句只留一份：先写好指向新录音的清单，成功后再删旧文件；
            // 这样写清单失败时旧录音与旧清单都还在，不会留下指向已删文件的清单项
            manifest.sentences[String(params.sentenceIndex)] = { index: params.sentenceIndex, take };
            await this.writeManifest(folder, manifest);
            if (previous) {
                await this.fileSystemGateway.removeFileIfExists(path.join(folder, previous.take.fileName));
            }
            await this.writeManifest(folder, manifest);
            // 转换与清单都成功后，原始 webm 只是中间产物，立即删除避免双份占用
            await this.fileSystemGateway.removeFileIfExists(rawFile);

            this.logger.info('配音录音已保存', { job, sentenceIndex: params.sentenceIndex, durationSec: take.durationSec });
            return { ...take, filePath: wavFile };
        } catch (error) {
            // 失败时清掉半成品，避免残留无效文件混进后续导出
            await this.fileSystemGateway.removeFileIfExists(rawFile);
            await this.fileSystemGateway.removeFileIfExists(wavFile);
            throw error;
        }
    }

    public async list(videoKey: string): Promise<DubbingManifest | null> {
        const { folder } = await this.resolveVideoFolder(videoKey);
        const manifestFile = path.join(folder, 'dubbing.json');
        if (!(await this.fileSystemGateway.fileExists(manifestFile))) {
            return null;
        }
        return await this.readManifest(videoKey);
    }

    public async listLibrary(): Promise<DubbingLibraryEntry[]> {
        const root = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.DUBBING);
        const names = await this.fileSystemGateway.listDirectoryNames(root);
        const entries: DubbingLibraryEntry[] = [];
        for (const name of names) {
            if (!VIDEO_KEY_PATTERN.test(name)) {
                this.logger.warn('跳过非法配音目录', { folder: name });
                continue;
            }
            const manifestFile = path.join(root, name, 'dubbing.json');
            if (!(await this.fileSystemGateway.fileExists(manifestFile))) {
                continue;
            }
            let manifest: DubbingManifest;
            try {
                manifest = await this.readManifest(name);
            } catch (error) {
                // 单个清单损坏不应让整个列表不可用；错误照常落日志暴露问题
                this.logger.error('读取配音清单失败，跳过该条目', { videoKey: name, error });
                continue;
            }
            const videoPath = manifest.videoPath;
            if (!videoPath) {
                this.logger.warn('配音清单缺少视频路径，跳过该条目', { videoKey: name });
                continue;
            }
            // 视频被删或移走属正常状态：不作为错误，仅跳过
            if (!(await this.fileSystemGateway.fileExists(videoPath))) {
                this.logger.warn('视频文件不存在，跳过该条目', { videoKey: name, videoPath });
                continue;
            }
            const takes = Object.values(manifest.sentences);
            entries.push({
                videoKey: name,
                videoPath,
                videoName: path.basename(videoPath),
                dubbedSentenceCount: takes.length,
                updatedAt: takes.reduce((max, record) => Math.max(max, record.take.createdAt), 0),
            });
        }
        entries.sort((a, b) => b.updatedAt - a.updatedAt);
        return entries;
    }

    public async clearSentence(params: { videoKey: string; sentenceIndex: number }): Promise<void> {
        const { folder, videoKey } = await this.resolveVideoFolder(params.videoKey);
        const manifest = await this.readManifest(videoKey);
        const record = manifest.sentences[String(params.sentenceIndex)];
        if (record) {
            await this.fileSystemGateway.removeFileIfExists(path.join(folder, record.take.fileName));
            delete manifest.sentences[String(params.sentenceIndex)];
            await this.writeManifest(folder, manifest);
        }
    }

    public async clearVideo(videoKey: string): Promise<void> {
        const { folder } = await this.resolveVideoFolder(videoKey);
        await this.fileSystemGateway.removeDirectoryIfExists(folder);
    }

    public async exportDubbedVideo(params: {
        videoKey: string;
        outputFolder: string;
    }): Promise<string> {
        if (this.exporting) {
            throw new Error('已有配音导出任务在进行中，请等待完成后再试');
        }
        this.exporting = true;
        const job = `dubbing-export:${params.videoKey}`;
        try {
            return await this.runExport(params, job);
        } finally {
            this.exporting = false;
        }
    }

    /**
     * 执行导出流水线：从清单取视频与字幕路径、推导各句时间区间 → ffmpeg 混音导出，全程向渲染端推送进度。
     */
    private async runExport(params: {
        videoKey: string;
        outputFolder: string;
    }, job: string): Promise<string> {
        const { folder, videoKey } = await this.resolveVideoFolder(params.videoKey);
        const manifest = await this.readManifest(videoKey);
        const videoPath = manifest.videoPath;
        const subtitlePath = manifest.subtitlePath;
        const records = Object.values(manifest.sentences);
        if (records.length === 0) {
            throw new Error('没有已配音的句子，无需导出');
        }
        if (!videoPath) {
            throw new Error('这份配音没有记录对应的视频路径，无法导出');
        }
        if (!subtitlePath) {
            throw new Error('这份配音没有记录对应的字幕文件，无法导出');
        }

        // 每句时间区间由字幕重新推导（含时间轴微调），不落盘派生数据
        const parsed = await this.subtitleService.parseSrt(subtitlePath);
        const sentenceByIndex = new Map(parsed.sentences.map((sentence) => [sentence.index, sentence]));
        const mixSegments: Array<{ startSecond: number; endSecond: number; takeFile: string; takeDurationSecond: number }> = [];
        for (const record of [...records].sort((a, b) => a.index - b.index)) {
            const sentence = sentenceByIndex.get(record.index);
            if (!sentence) {
                throw new Error(`字幕里找不到第 ${record.index} 句，无法确定时间区间`);
            }
            mixSegments.push({
                startSecond: sentence.adjustedStart ?? sentence.start,
                endSecond: sentence.adjustedEnd ?? sentence.end,
                takeFile: path.join(folder, record.take.fileName),
                takeDurationSecond: record.take.durationSec,
            });
        }

        const outputFile = path.join(params.outputFolder, `${this.buildExportName(videoPath)}.mp4`);
        await this.fileSystemGateway.ensureDirectory(params.outputFolder);

        this.logger.info('配音导出开始', { job, videoPath, segmentCount: mixSegments.length, outputFile });
        this.pushExportStatus({ videoKey, status: 'running', progress: 0 });

        try {
            await this.ffmpegService.mixDubbedAudio({
                videoFile: videoPath,
                outputFile,
                segments: mixSegments,
                job,
                onProgress: (progress) => {
                    this.pushExportStatus({ videoKey, status: 'running', progress });
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('配音导出失败', { job, error });
            this.pushExportStatus({ videoKey, status: 'failed', progress: 0, message });
            throw error;
        }

        this.logger.info('配音导出完成', { job, outputFile });
        this.pushExportStatus({ videoKey, status: 'completed', progress: 100, outputPath: outputFile });
        return outputFile;
    }

    /**
     * 生成导出产物文件名：`<视频名>-dubbed-<时间戳>`。
     */
    private buildExportName(videoPath: string): string {
        const baseName = path.basename(videoPath, path.extname(videoPath)) || 'video';
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `${baseName}-dubbed-${stamp}`;
    }

    /**
     * 校验 videoKey 并解析（不创建）该视频的配音目录。
     */
    private async resolveVideoFolder(videoKey: string): Promise<{ folder: string; videoKey: string }> {
        if (!VIDEO_KEY_PATTERN.test(videoKey)) {
            throw new Error(`非法的配音目录键：${videoKey}`);
        }
        const root = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.DUBBING);
        return { folder: path.join(root, videoKey), videoKey };
    }

    /**
     * 读取清单；清单文件缺失时返回空清单（新视频的初始状态）。
     */
    private async readManifest(videoKey: string): Promise<DubbingManifest> {
        const { folder } = await this.resolveVideoFolder(videoKey);
        const manifestFile = path.join(folder, 'dubbing.json');
        if (!(await this.fileSystemGateway.fileExists(manifestFile))) {
            return { videoKey, sentences: {} };
        }
        const raw = await this.fileSystemGateway.readTextFile(manifestFile);
        try {
            const parsed = JSON.parse(raw) as DubbingManifest;
            if (parsed.videoKey !== videoKey || typeof parsed.sentences !== 'object' || parsed.sentences === null) {
                throw new Error('清单结构不匹配');
            }
            // 回放路径属于派生数据，读取时统一填充，不落盘
            for (const record of Object.values(parsed.sentences)) {
                record.take.filePath = path.join(folder, record.take.fileName);
            }
            return parsed;
        } catch (error) {
            this.logger.error('配音清单损坏', { videoKey, error });
            throw new Error(`配音清单文件损坏，无法读取：${manifestFile}`);
        }
    }

    /**
     * 写入清单；filePath 是读取时填充的派生字段，写入时剥掉。
     */
    private async writeManifest(folder: string, manifest: DubbingManifest): Promise<void> {
        await this.fileSystemGateway.ensureDirectory(folder);
        await this.fileSystemGateway.writeTextFile(
            path.join(folder, 'dubbing.json'),
            JSON.stringify(manifest, (key, value) => (key === 'filePath' ? undefined : value), 2),
        );
    }

    /**
     * 推送导出进度到渲染端。
     */
    private pushExportStatus(status: { videoKey: string; status: 'running' | 'completed' | 'failed'; progress: number; message?: string; outputPath?: string }): void {
        this.rendererGateway.fireAndForget('dubbing/export-status-update', status);
    }
}
