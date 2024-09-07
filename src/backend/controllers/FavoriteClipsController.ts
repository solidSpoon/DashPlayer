import Controller from '@/backend/interfaces/controller';
import { SrtLine } from '@/common/utils/SrtUtil';
import FavoriteClipsService from '@/backend/services/FavoriteClipsService';
import registerRoute from '@/common/api/register';
import { OssObject } from '@/common/types/OssObject';

export default class FavoriteClipsController implements Controller {

    public async addFavoriteClip({ videoPath, srtClip, srtContext }: {
        videoPath: string,
        srtClip: SrtLine,
        srtContext: SrtLine[]
    }) {
        return FavoriteClipsService.addFavoriteClipAsync(videoPath, srtClip, srtContext);
    }

    public async search(keyword: string): Promise<OssObject[]> {
        return FavoriteClipsService.search(keyword);
    }


    registerRoutes(): void {
        registerRoute('favorite-clips/add', this.addFavoriteClip);
        registerRoute('favorite-clips/search', this.search);
    }

}
