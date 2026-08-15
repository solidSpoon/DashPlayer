import hash from 'object-hash';
import path from 'path';
import TimeUtil from '@/common/utils/TimeUtil';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { ClipQuery } from '@/common/api/dto';
import StrUtil from '@/common/utils/str-util';

import { SrtSentence } from '@/common/types/SentenceC';
import { FavouriteClipsService } from '@/backend/application/services/FavouriteClipsService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import CacheService from '@/backend/application/services/CacheService';
import { ClipOssService } from '@/backend/application/services/OssService';
import CollUtil from '@/common/utils/CollUtil';
import FfmpegService from '@/backend/application/services/FfmpegService';
import { concurrency } from '@/backend/application/kernel/concurrency';
import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import { Tag } from '@/common/contracts/tag';
import FavouriteClipsRepository, { FavouriteClipsReplaceAllItem } from '@/backend/application/ports/repositories/FavouriteClipsRepository';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';

/**
 * 收藏片段队列中的待执行操作。
 */
type ClipTask = {
    /** 源视频绝对路径；取消任务不需要该字段。 */
    videoPath: string,
    /** 字幕缓存键。 */
    srtKey: string,
    /** 目标字幕行序号。 */
    indexInSrt: number,
    /** 用于覆盖同一片段旧操作的稳定键。 */
    clipKey: string,
    /** 当前片段应新增还是取消。 */
    operation: 'add' | 'cancel'
};
@injectable()
export default class FavouriteClipsServiceImpl implements FavouriteClipsService {
    private readonly logger = getMainLogger('FavouriteClipsServiceImpl');
    @inject(TYPES.ClipOssService)
    private clipOssService!: ClipOssService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    @inject(TYPES.FavouriteClipsRepository)
    private favouriteClipsRepository!: FavouriteClipsRepository;

    /** 待执行的收藏片段操作；相同片段的新操作会覆盖旧操作。 */
    private readonly taskQueue = new Map<string, ClipTask>();

    /** 当前是否已有队列消费者在运行。 */
    private isQueueDraining = false;

    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;


    /**
     * 将字幕行加入收藏片段队列。
     *
     * @param videoPath 源视频绝对路径。
     * @param srtKey 字幕缓存键。
     * @param indexInSrt 字幕行序号。
     */
    public async addClip(videoPath: string, srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath,
            srtKey,
            indexInSrt,
            clipKey,
            operation: 'add'
        });
        this.requestQueueDrain();
    }

    /**
     * 取消尚未完成的收藏片段新增操作。
     *
     * @param srtKey 字幕缓存键。
     * @param indexInSrt 字幕行序号。
     */
    public async cancelAddClip(srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath: '',
            srtKey,
            indexInSrt,
            clipKey,
            operation: 'cancel'
        });
        this.requestQueueDrain();
    }

    /**
     * 根据字幕上下文生成收藏片段的稳定键。
     *
     * @param srtKey 字幕缓存键。
     * @param indexInSrt 字幕行序号。
     * @returns 片段稳定键。
     */
    private mapToClipKey(srtKey: string, indexInSrt: number): string {
        const srt = this.cacheService.get('cache:srt', srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    /**
     * 请求消费收藏片段队列。
     *
     * 队列已有消费者时直接返回；消费过程中新增的任务由当前消费者继续处理。
     */
    private requestQueueDrain(): void {
        if (this.isQueueDraining) {
            return;
        }

        this.isQueueDraining = true;
        void this.drainQueue();
    }

    /**
     * 顺序消费全部收藏片段任务。
     *
     * 每次只在同步锁内处理一个任务，避免全量 OSS 同步被长队列长期阻塞。
     */
    private async drainQueue(): Promise<void> {
        try {
            while (await this.processNextQueueTask()) {
                // 循环条件已表达是否仍有任务，无需额外轮询。
            }
        } catch (error) {
            this.logger.error('收藏片段队列消费异常', { error });
        } finally {
            this.isQueueDraining = false;
            if (this.taskQueue.size > 0) {
                this.requestQueueDrain();
            }
        }
    }

    /**
     * 在同步锁内处理队首任务。
     *
     * @returns 本次实际取得任务时返回 `true`。
     */
    private async processNextQueueTask(): Promise<boolean> {
        return concurrency.withMutex('favourite-clip-sync', async () => {
            const task = this.taskQueue.values().next().value as ClipTask | undefined;
            if (!task) {
                return false;
            }

            try {
                const exists = await this.clipInDb(task.clipKey);
                if (task.operation === 'add' && !exists) {
                    await this.taskAddOperation(task);
                }
                if (task.operation === 'cancel' && exists) {
                    await this.taskCancelOperation(task);
                }
            } catch (error) {
                this.logger.error('收藏片段任务失败，已跳过', {
                    clipKey: task.clipKey,
                    operation: task.operation,
                    error,
                });
                this.notifyClipTaskFailed(task, error);
            } finally {
                if (this.taskQueue.get(task.clipKey) === task) {
                    this.taskQueue.delete(task.clipKey);
                }
            }

            return true;
        });
    }

    /**
     * 创建收藏片段并写入外部媒体库与本地索引。
     *
     * @param task 待执行的新增任务。
     */
    private async taskAddOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        const folder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
        const tempName = path.join(folder, key + '.mp4');
        if (await this.clipInDb(key)) {
            return;
        }
        try {
            const [trimStart, trimEnd] = this.mapTrimRange(srt, task.indexInSrt);
            await this.ffmpegService.trimVideo(task.videoPath, trimStart, trimEnd, tempName);
            await this.clipOssService.putClip(key, tempName, metaData);
            const meta = await this.clipOssService.get(key);
            if (!meta) {
                throw new Error('收藏片段元数据不存在');
            }
            await this.addToDb(meta);
        } finally {
            await this.fileSystemGateway.removeFileIfExists(tempName);
        }
    }

    /**
     * 删除收藏片段。
     *
     * @param task 待执行的取消任务。
     */
    public async taskCancelOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        await this.deleteFavoriteClip(key);
    }

    /**
     * 向用户显示收藏片段任务失败原因。
     *
     * @param task 失败任务。
     * @param error 原始异常。
     */
    private notifyClipTaskFailed(task: ClipTask, error: unknown): void {
        const reason = error instanceof Error ? error.message.trim() : '';
        const message = reason
            ? `收藏片段处理失败，已跳过：${reason}`
            : '收藏片段处理失败，已跳过';
        this.rendererGateway.fireAndForget('ui/show-toast', {
            message,
            variant: 'error',
            duration: 5000,
        });
        this.logger.debug('收藏片段失败通知已发送', {
            clipKey: task.clipKey,
            operation: task.operation,
        });
    }

    private mapTrimRange(srt: SrtSentence, indexInSrt: number): [number, number] {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const startTime = clipContext[0].start ?? 0;
        return [startTime, clipContext[clipContext.length - 1].end ?? 0];
    }

    private mapToMetaKey(srt: SrtSentence, indexInSrt: number): string {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    private mapToMetaData(videoPath: string, srt: SrtSentence, indexInSrt: number): ClipMeta {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const clipLine = SrtUtil.findByIndex(srtLines, indexInSrt) as SrtLine;
        clipContext.map((item) =>
            item.contentEn
        ).filter((item) => StrUtil.isNotBlank(item)).join('\n');
        const startTime = clipContext[0].start ?? 0;
        const clipJson: ClipSrtLine[] = clipContext.map((item, index) => ({
            index: index,
            start: item.start - startTime,
            end: item.end - startTime,
            contentEn: item.contentEn,
            contentZh: item.contentZh,
            isClip: item === clipLine
        }));
        return {
            clip_file: '',
            thumbnail_file: '',
            tags: [],
            video_name: videoPath,
            created_at: Date.now(),
            clip_content: clipJson
        };
    }

    public async deleteFavoriteClip(key: string): Promise<void> {
        await this.favouriteClipsRepository.deleteClipAndPruneTags(key);
        await this.clipOssService.delete(key);
    }

    async exists(srtKey: string, linesInSrt: number[]): Promise<Map<number, boolean>> {
        const srtSentence = this.cacheService.get('cache:srt', srtKey);
        if (!srtSentence) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const result = new Map<number, boolean>();
        for (const lineIndex of linesInSrt) {
            const clipKey = this.mapToClipKey(srtKey, lineIndex);
            const info = this.taskQueue.get(clipKey);
            if (info) {
                result.set(lineIndex, info.operation === 'add');
                continue;
            }
            const value = await this.clipInDb(clipKey);
            result.set(lineIndex, value);
        }
        return result;
    }

    public async search(query?: ClipQuery): Promise<(OssBaseMeta & ClipMeta)[]> {
        const keys = await this.favouriteClipsRepository.searchClipKeys(query);
        return Promise.all(keys
            .map((key) => this.clipOssService.get(key)))
            .then((res) => res.filter((item) => item !== null)) as Promise<(OssBaseMeta & ClipMeta)[]>;

    }

    private async addToDb(metaData: ClipMeta & OssBaseMeta) {
        const srtLines = metaData.clip_content ?? [];
        const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
        const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');
        await this.favouriteClipsRepository.saveClipWithTags({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: srtClip,
            srt_context: srtContext,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }, CollUtil.emptyIfNull(metaData.tags));
    }

    private async clipInDb(key: string) {
        return this.favouriteClipsRepository.existsClipKey(key);
    }

    async queryClipTags(key: string): Promise<Tag[]> {
        return this.favouriteClipsRepository.listTagsByClipKey(key);
    }


    async addClipTag(key: string, tagId: number): Promise<void> {
        await this.favouriteClipsRepository.insertClipTagIgnore(key, tagId);
        await this.syncTagToOss(key);
    }

    async deleteClipTag(key: string, tagId: number): Promise<void> {
        await this.favouriteClipsRepository.deleteClipTagAndPruneTag(key, tagId);
        await this.syncTagToOss(key);
    }

    async renameTag(tagId: number, newName: string): Promise<void> {
        await this.favouriteClipsRepository.updateTagName(tagId, newName);
        // 查出来所有带有这个tag的clip
        const clipKeys = await this.favouriteClipsRepository.listClipKeysByTagId(tagId);
        for (const clipKey of clipKeys) {
            await this.syncTagToOss(clipKey);
        }
    }

    taskInfo(): number {
        return this.taskQueue.size;
    }

    private async syncTagToOss(key: string): Promise<void> {
        const tags = await this.queryClipTags(key);
        const tagNames = tags.map((tag) => tag.name);
        await this.clipOssService.updateTags(key, tagNames);
    }

    /**
     * 清除数据库，重新从 OSS 同步。
     *
     * 行为说明：
     * - 先把所有远端片段读入内存，再在单个事务内清空并重灌，任一步失败整体回滚；
     * - 读取远端发生在事务外，避免在同步事务里做 IO；
     * - 与队列任务使用同一把互斥锁串行执行，避免全量重灌清掉并发新增的片段。
     */
    async syncFromOss() {
        await concurrency.withMutex('favourite-clip-sync', async () => {
            const keys = await this.clipOssService.list();
            const clips: FavouriteClipsReplaceAllItem[] = [];
            for (const key of keys) {
                const clip = await this.clipOssService.get(key);
                if (!clip) {
                    continue;
                }
                const srtLines = clip.clip_content ?? [];
                const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
                const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');
                clips.push({
                    clip: {
                        key: clip.key,
                        video_name: clip.video_name,
                        srt_clip: srtClip,
                        srt_context: srtContext,
                        created_at: TimeUtil.timeUtc(),
                        updated_at: TimeUtil.timeUtc(),
                    },
                    tags: CollUtil.emptyIfNull(clip.tags),
                });
            }
            await this.favouriteClipsRepository.replaceAll(clips);
        });
    }

}
