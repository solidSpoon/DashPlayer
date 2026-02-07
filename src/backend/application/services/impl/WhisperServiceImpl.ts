import fs from 'fs';
import path from 'path';
import { DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import hash from 'object-hash';
import { inject, injectable } from 'inversify';
import DpTaskService from '../DpTaskService';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/application/services/FfmpegService';
import WhisperService from '@/backend/application/services/WhisperService';
import LocationService, { LocationType } from '@/backend/application/services/LocationService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { OpenAiWhisper } from '@/backend/application/ports/gateways/OpenAiWhisper';
import { WithSemaphore } from '@/backend/application/kernel/concurrency/decorators';
import { SplitChunk, WhisperContext, WhisperContextSchema, WhisperResponse } from '@/common/types/video-info';
import { ConfigStoreFactory } from '@/backend/application/ports/gateways/ConfigStore';
import FileUtil from '@/backend/utils/FileUtil';
import { CancelByUserError, WhisperResponseFormatError } from '@/backend/application/errors/errors';
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";

/**
 * 将 Whisper 的 API 响应转换成 SRT 文件格式
 */
function toSrt(chunks: SplitChunk[]): string {
    // 按 offset 排序确保顺序正确
    chunks.sort((a, b) => a.offset - b.offset);
    let counter = 1;
    const lines: SrtLine[] = [];
    for (const c of chunks) {
        const segments = c.response?.segments ?? [];
        for (const segment of segments) {
            lines.push({
                index: counter,
                start: segment.start + c.offset,
                end: segment.end + c.offset,
                contentEn: segment.text,
                contentZh: ''
            });
            counter++;
        }
    }
    return SrtUtil.srtLinesToSrt(lines, {
        reindex: true,
    });
}

// 设置过期时间阈值，单位毫秒（此处示例为 3 小时）
const EXPIRATION_THRESHOLD = 3 * 60 * 60 * 1000;

@injectable()
class WhisperServiceImpl implements WhisperService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.OpenAiWhisper)
    private openAiWhisperGateway!: OpenAiWhisper;

    @inject(TYPES.ConfigStoreFactory)
    private configStoreFactory!: ConfigStoreFactory;
    private readonly logger = getMainLogger('WhisperServiceImpl');

    private static readonly INFO_FILE = 'info.json';

    public async transcript(taskId: number, filePath: string) {
        this.dpTaskService.process(taskId, { progress: '正在转换音频' });
        try {
            // 分配用于储存中间产生的文件夹
            const folder = this.allocateFolder(filePath);

            // 初始化默认的上下文
            const defaultContext: WhisperContext = {
                filePath,
                folder,
                state: 'init',
                videoInfo: await this.ffmpegService.getVideoInfo(filePath),
                chunks: [],
                updatedTime: Date.now()
            };

            const infoPath = path.join(folder, WhisperServiceImpl.INFO_FILE);
            const configTender = this.configStoreFactory.create<WhisperContext, typeof WhisperContextSchema>(
                infoPath,
                WhisperContextSchema,
                defaultContext,
                {
                    onInvalid: (error) => {
                        this.logger.warn('whisper context invalid, will try recover with default context', { error });
                    },
                    onAutoRepaired: () => {
                        this.logger.info('whisper context auto repaired with default context', { infoPath });
                    },
                },
            );

            // 读取当前上下文
            const context: WhisperContext = configTender.get();

            // 判断是否需要重新分割转录：状态不为 processed、文件过期（3小时）或视频文件发生变化
            const newVideoInfo = await this.ffmpegService.getVideoInfo(filePath);
            const videoChanged = !FileUtil.compareVideoInfo(context.videoInfo, newVideoInfo);
            const expired = Date.now() - context.updatedTime > EXPIRATION_THRESHOLD;
            if (context.state !== 'processed' || expired || videoChanged) {
                // 重新转换并分割
                await this.convertAndSplit(taskId, context);
                context.videoInfo = newVideoInfo;
                context.updatedTime = Date.now();
                context.state = 'processed';
                // 先保存最新的 chunks 信息
                configTender.save(context);
            }

            // 检查是否取消
            this.dpTaskService.checkCancel(taskId);

            // 获取尚未转录的 chunk
            const unfinishedChunks = context.chunks.filter(chunk => !chunk.response);
            if (unfinishedChunks.length === 0) {
                this.dpTaskService.finish(taskId, { progress: '转录完成' });
                context.state = 'done';
                configTender.save(context);
                return;
            }

            // 使用共享计数器更新并行转录进度
            let completedCount = context.chunks.filter(chunk => chunk.response).length;

            this.dpTaskService.process(taskId, {
                progress: `正在转录 ${Math.floor((completedCount / context.chunks.length) * 100 * 0.6) + 40}%`
            });

            try {
                // 对所有分片并发执行转录
                const results = await Promise.allSettled(context.chunks.map(async (chunk) => {
                    // 如果该 chunk 已经有结果，则跳过
                    if (chunk.response) return;
                    await this.whisperThreeTimes(taskId, chunk);
                    completedCount = context.chunks.filter(chunk => chunk.response).length;
                    const progress = Math.floor((completedCount / context.chunks.length) * 100 * 0.6) + 40;
                    this.dpTaskService.update({ id: taskId, progress: `正在转录 ${progress}%` });
                }));
                // 检查是否有错误
                for (const result of results) {
                    if (result.status === 'rejected') {
                        throw result.reason;
                    }
                }
            } finally {
                // 保存当前状态
                configTender.save(context);
            }

            // 整理结果，生成 SRT 文件
            const srtName = filePath.replace(path.extname(filePath), '.srt');
            this.logger.info(`[WhisperService] Task ID: ${taskId} - 生成 SRT 文件: ${srtName}`);
            fs.writeFileSync(srtName, toSrt(context.chunks));

            // 完成任务，并保存状态
            context.state = 'done';
            configTender.save(context);
            this.dpTaskService.finish(taskId, { progress: '转录完成' });
        } catch (error) {
            this.logger.error('whisper task failed', { error });
            if (!(error instanceof Error)) throw error;
            const cancel = error instanceof CancelByUserError;
            this.dpTaskService.update({
                id: taskId,
                status: cancel ? DpTaskState.CANCELLED : DpTaskState.FAILED,
                progress: cancel ? '任务取消' : error.message
            });
        }
        this.cleanExpiredFolders();
    }

    /**
     * 针对单个 chunk 调用 Whisper API，最多尝试 3 次
     */
    private async whisperThreeTimes(taskId: number, chunk: SplitChunk) {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                this.logger.info(`[WhisperService] Task ID: ${taskId} - Attempt ${attempt + 1} to invoke Whisper API for chunk offset ${chunk.offset}`);
                chunk.response = await this.whisper(taskId, chunk);
                return;
            } catch (err) {
                if (err instanceof WhisperResponseFormatError) {
                    // 如果是格式错误，直接抛出
                    throw Error('Whisper API 返回格式错误');
                }
                lastError = err;
            }
            this.dpTaskService.checkCancel(taskId);
        }
        throw lastError;
    }

    /**
     * 调用 Whisper API
     */
    @WithSemaphore('whisper')
    private async whisper(taskId: number, chunk: SplitChunk): Promise<WhisperResponse> {
        let req;
        try {
            req = this.openAiWhisperGateway.createRequest(chunk.filePath);
        } catch (error) {
            this.dpTaskService.fail(taskId, { progress: '未设置 OpenAI 密钥' });
            throw error;
        }
        this.dpTaskService.registerTask(taskId, req);
        const response = await req.invoke();
        return { ...response };
    }

    /**
     * 删除指定目录下的所有文件，然后利用 ffmpeg 执行分割音频操作并生成 chunks
     */
    async convertAndSplit(taskId: number, context: WhisperContext): Promise<void> {
        const filesInFolder = await FileUtil.listFiles(context.folder);
        for (const file of filesInFolder) {
            try {
                fs.unlinkSync(path.join(context.folder, file));
            } catch (err) {
                this.logger.warn(`[WhisperService] 忽略删除文件 ${file} 的错误：${err}`);
            }
        }
        // 执行分割操作
        const files = await this.ffmpegService.splitToAudio({
            taskId,
            inputFile: context.filePath,
            outputFolder: context.folder,
            segmentTime: 60,
            onProgress: (progress) => {
                this.dpTaskService.update({
                    id: taskId,
                    progress: `正在分割音频 ${Math.floor(progress * 0.4)}%`
                });
            }
        });
        const chunks: SplitChunk[] = [];
        let offset = 0;
        for (const file of files) {
            const duration = await this.ffmpegService.duration(file);
            chunks.push({ offset, filePath: file });
            offset += duration;
        }
        context.chunks = chunks;
    }

    /**
     * 为指定文件分配一个存放临时文件的文件夹（文件夹名称基于文件路径的 hash 值）
     */
    private allocateFolder(filePath: string): string {
        const folderName = hash(filePath);
        const tempDir = path.join(this.locationService.getDetailLibraryPath(LocationType.TEMP), 'whisper', folderName);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        return tempDir;
    }

    /**
     * 扫描 whisper 的临时目录，删除超过有效期的目录
     */
    private cleanExpiredFolders(): void {
        try {
            const whisperBaseDir = path.join(
                this.locationService.getDetailLibraryPath(LocationType.TEMP),
                'whisper'
            );
            if (!fs.existsSync(whisperBaseDir)) return;
            const folders = fs.readdirSync(whisperBaseDir);
            for (const folderName of folders) {
                const folderPath = path.join(whisperBaseDir, folderName);
                if (!fs.statSync(folderPath).isDirectory()) continue;
                let folderExpired = false;
                const infoPath = path.join(folderPath, WhisperServiceImpl.INFO_FILE);
                if (fs.existsSync(infoPath)) {
                    try {
                        const content = fs.readFileSync(infoPath, { encoding: 'utf8' });
                        const info = JSON.parse(content) as Partial<WhisperContext>;
                        // 检查 updatedTime 是否存在且是数字，否则直接认定为过期
                        if (
                            typeof info.updatedTime !== 'number' ||
                            Date.now() - info.updatedTime > EXPIRATION_THRESHOLD
                        ) {
                            folderExpired = true;
                        }
                    } catch (err) {
                        this.logger.warn(
                            `[WhisperService] 解析${infoPath}失败：${err}，将直接删除此目录`
                        );
                        folderExpired = true;
                    }
                } else {
                    // info.json 不存在直接删除
                    folderExpired = true;
                }
                if (folderExpired) {
                    this.logger.info(`[WhisperService] 删除过期目录: ${folderPath}`);
                    // 删除整个文件夹（包括目录下的所有内容）
                    fs.rmSync(folderPath, { recursive: true, force: true });
                }
            }
        } catch (err) {
            this.logger.error(`[WhisperService] 清理过期目录失败：${err}`);
        }
    }
}

export default WhisperServiceImpl;
