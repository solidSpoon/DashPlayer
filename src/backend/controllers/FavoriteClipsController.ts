import Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { Tag } from '@/common/contracts/tag';
import { ClipQuery } from '@/common/api/dto';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';
import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import SubtitleTranslationService from '@/backend/services/subtitle-translation/SubtitleTranslationService';

@injectable()
export default class FavoriteClipsController implements Controller {
    @inject(TYPES.FavouriteClips)
    private favouriteClipsService!: FavouriteClipsService;
    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;
    @inject(TYPES.SubtitleTranslationService)
    private subtitleTranslationService!: SubtitleTranslationService;

    public async addClip({ videoPath, srtKey, indexInSrt }: {
        videoPath: string,
        srtKey: string,
        indexInSrt: number
    }) {
        return this.favouriteClipsService.addClip(videoPath, srtKey, indexInSrt);
    }

    public async cancelAddClip({ srtKey, indexInSrt }: { srtKey: string, indexInSrt: number }): Promise<void> {
        return this.favouriteClipsService.cancelAddClip(srtKey, indexInSrt);
    }

    public async exists({ srtKey, linesInSrt }: {
        srtKey: string,
        linesInSrt: number[]
    }): Promise<Map<number, boolean>> {
        return this.favouriteClipsService.exists(srtKey, linesInSrt);
    }

    public async search(query?: ClipQuery): Promise<(OssBaseMeta & ClipMeta)[]> {
        return this.favouriteClipsService.search(query);
    }

    public queryClipTags(key: string): Promise<Tag[]> {
        return this.favouriteClipsService.queryClipTags(key);
    }

    public addClipTag({ key, tagId }: { key: string, tagId: number }): Promise<void> {
        return this.favouriteClipsService.addClipTag(key, tagId);
    }

    public deleteClipTag({ key, tagId }: { key: string, tagId: number }): Promise<void> {
        return this.favouriteClipsService.deleteClipTag(key, tagId);
    }

    public async taskInfo(): Promise<number> {
        return this.favouriteClipsService.taskInfo();
    }

    public async delete(key: string): Promise<void> {
        return this.favouriteClipsService.deleteFavoriteClip(key);
    }

    /**
     * 使用当前字幕翻译配置批量翻译收藏片段文本。
     *
     * @param sentences 收藏片段中的待翻译文本。
     * @returns 归一化原文到翻译结果的映射。
     */
    public async translate(sentences: string[]): Promise<Map<string, string>> {
        return this.subtitleTranslationService.translateTexts(sentences);
    }

    /**
     * 从外部媒体库重新回灌收藏片段索引。
     *
     * 行为说明：
     * - 回灌前先校验媒体库目录可访问；
     * - 目录异常时直接抛错，避免静默清空数据库后又无法恢复。
     */
    public async syncFromOss(): Promise<void> {
        await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.FAVORITE_CLIPS_COLLECTION);
        return this.favouriteClipsService.syncFromOss();
    }

    registerRoutes(): void {
        registerRoute('favorite-clips/add', (p) => this.addClip(p));
        registerRoute('favorite-clips/cancel-add', (p) => this.cancelAddClip(p));
        registerRoute('favorite-clips/exists', (p) => this.exists(p));
        registerRoute('favorite-clips/search', (p) => this.search(p));
        registerRoute('favorite-clips/query-clip-tags', (p) => this.queryClipTags(p));
        registerRoute('favorite-clips/add-clip-tag', (p) => this.addClipTag(p));
        registerRoute('favorite-clips/delete-clip-tag', (p) => this.deleteClipTag(p));
        registerRoute('favorite-clips/task-info', () => this.taskInfo());
        registerRoute('favorite-clips/delete', (p) => this.delete(p));
        registerRoute('favorite-clips/translate', (p) => this.translate(p));
        registerRoute('favorite-clips/sync-from-oss', () => this.syncFromOss());
    }

}
