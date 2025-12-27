import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import { ClipQuery } from '@/common/api/dto';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';
import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';

@injectable()
export default class FavoriteClipsController implements Controller {
    @inject(TYPES.FavouriteClips)
    private favouriteClipsService!: FavouriteClipsService;

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

    public async syncFromOss(): Promise<void> {
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
        registerRoute('favorite-clips/sync-from-oss', () => this.syncFromOss());
    }

}
