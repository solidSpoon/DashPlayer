import hash from 'object-hash';
import path from 'path';
import TimeUtil from '@/common/utils/TimeUtil';
import fs from 'fs';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable, postConstruct } from 'inversify';
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
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import FavouriteClipsRepository, { FavouriteClipsReplaceAllItem } from '@/backend/application/ports/repositories/FavouriteClipsRepository';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';

type ClipTask = {
    videoPath: string,
    srtKey: string,
    indexInSrt: number,
    clipKey: string,
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

    /**
     * key: hash(srtContext)
     * @private
     */
    private taskQueue: Map<string, ClipTask> = new Map();


    public async addClip(videoPath: string, srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath,
            srtKey,
            indexInSrt,
            clipKey,
            operation: 'add'
        });
    }

    public async cancelAddClip(srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath: '',
            srtKey,
            indexInSrt,
            clipKey,
            operation: 'cancel'
        });
    }

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
     * 定时任务：处理收藏片段的新增/取消队列。
     *
     * 行为说明：
     * - 与 syncFromOss 使用同一把互斥锁串行执行，避免全量重灌清掉并发新增的片段。
     */
    async checkQueue() {
        await concurrency.withMutex('favourite-clip-sync', async () => {
            await this.doCheckQueue();
        });
    }

    private async doCheckQueue() {
        if (this.taskQueue.size === 0) {
            return;
        }
        const tempMapping = new Map(this.taskQueue);
        const newKeys = Array.from(tempMapping.keys());

        const existsKeys = await this.favouriteClipsRepository.listExistingClipKeys(newKeys);
        const notExistKeys = newKeys.filter((key) => !existsKeys.includes(key));

        for (const k of notExistKeys) {
            const task = tempMapping.get(k);
            if (!task) {
                this.logger.error('task not found');
                continue;
            }
            if (task.operation === 'add') {
                await this.taskAddOperation(task);
            }
            if (this.taskQueue.get(k) === task) {
                this.taskQueue.delete(k);
            }
        }
        for (const k of existsKeys) {
            const task = tempMapping.get(k);
            if (!task) {
                this.logger.error('task not found');
                continue;
            }
            if (task.operation === 'cancel') {
                await this.taskCancelOperation(task);
            }
            if (this.taskQueue.get(k) === task) {
                this.taskQueue.delete(k);
            }
        }
    }

    private async taskAddOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        const folder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
        const tempName = path.join(folder, key + '.mp4');
        if (await this.clipInDb(key)) {
            return;
        }
        const [trimStart, trimEnd] = this.mapTrimRange(srt, task.indexInSrt);
        await this.ffmpegService.trimVideo(task.videoPath, trimStart, trimEnd, tempName);
        await this.clipOssService.putClip(key, tempName, metaData);
        const meta = await this.clipOssService.get(key);
        if (!meta) {
            throw new Error('meta not found');
        }
        await this.addToDb(meta);
        fs.rmSync(tempName);
    }

    public async taskCancelOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        await this.deleteFavoriteClip(key);
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
     * - 与 checkQueue 使用同一把互斥锁串行执行，避免全量重灌清掉并发新增的片段。
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

    @postConstruct()
    public postConstruct() {
        const func = async () => {
            // dpLog.info('FavouriteClipsServiceImpl task start');
            await this.checkQueue();
            setTimeout(func, 1000);
        };
        func().catch((e) => {
            this.logger.error('FavouriteClipsServiceImpl loop failed', { error: e });
        });
    }

}
