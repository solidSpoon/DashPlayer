import ControllerT from '@/backend/interfaces/controllerT';
import { SrtLine } from '@/common/utils/SrtUtil';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsServiceImpl';
import registerRoute from '@/common/api/register';
import { OssObject } from '@/common/types/OssObject';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';

@injectable()
export default class FavoriteClipsController implements ControllerT {
    @inject(TYPES.FavouriteClips) private favouriteClipsService: FavouriteClipsService;

    public async addFavoriteClip({ videoPath, srtClip, srtContext }: {
        videoPath: string,
        srtClip: SrtLine,
        srtContext: SrtLine[]
    }) {
        return this.favouriteClipsService.addFavoriteClipAsync(videoPath, srtClip, srtContext);
    }

    public async search(keyword: string): Promise<OssObject[]> {
        return this.favouriteClipsService.search(keyword);
    }


    registerRoutes(): void {
        registerRoute('favorite-clips/add', this.addFavoriteClip.bind(this));
        registerRoute('favorite-clips/search', this.search.bind(this));
    }

}
