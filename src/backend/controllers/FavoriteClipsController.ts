import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import { OssObject } from '@/common/types/OssObject';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { Tag } from '@/backend/db/tables/tag';
import { ClipQuery } from '@/common/api/dto';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';

@injectable()
export default class FavoriteClipsController implements Controller {
    @inject(TYPES.FavouriteClips)
    private favouriteClipsService: FavouriteClipsService;

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

    public async search(query: ClipQuery): Promise<OssObject[]> {
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

    registerRoutes(): void {
        registerRoute('favorite-clips/add', (p) => this.addClip(p));
        registerRoute('favorite-clips/cancel-add', (p) => this.cancelAddClip(p));
        registerRoute('favorite-clips/exists', (p) => this.exists(p));
        registerRoute('favorite-clips/search', (p) => this.search(p));
        registerRoute('favorite-clips/query-clip-tags', (p) => this.queryClipTags(p));
        registerRoute('favorite-clips/add-clip-tag', (p) => this.addClipTag(p));
        registerRoute('favorite-clips/delete-clip-tag', (p) => this.deleteClipTag(p));
        registerRoute('favorite-clips/task-info', () => this.taskInfo());
    }

}