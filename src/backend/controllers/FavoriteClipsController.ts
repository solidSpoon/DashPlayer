import Controller from '@/backend/interfaces/controller';
import { SrtLine } from '@/common/utils/SrtUtil';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsServiceImpl';
import registerRoute from '@/common/api/register';
import { OssObject } from '@/common/types/OssObject';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { Tag } from '@/backend/db/tables/tag';
import { DateRange } from 'react-day-picker';
import { ClipQuery } from '@/common/api/dto';

@injectable()
export default class FavoriteClipsController implements Controller {
    @inject(TYPES.FavouriteClips) private favouriteClipsService: FavouriteClipsService;

    public async addFavoriteClip({ videoPath, srtClip, srtContext }: {
        videoPath: string,
        srtClip: SrtLine,
        srtContext: SrtLine[]
    }) {
        return this.favouriteClipsService.addFavoriteClipAsync(videoPath, srtClip, srtContext);
    }

    public async search(query:ClipQuery): Promise<OssObject[]> {
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

    registerRoutes(): void {
        registerRoute('favorite-clips/add', (p) => this.addFavoriteClip(p));
        registerRoute('favorite-clips/search', (p) => this.search(p));
        registerRoute('favorite-clips/query-clip-tags', (p) => this.queryClipTags(p));
        registerRoute('favorite-clips/add-clip-tag', (p) => this.addClipTag(p));
        registerRoute('favorite-clips/delete-clip-tag', (p) => this.deleteClipTag(p));
    }

}
