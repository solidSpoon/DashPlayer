import Controller from '@/backend/interfaces/controller';
import { SrtLine } from '@/common/utils/SrtUtil';
import FavoriteClipsService from '@/backend/services/FavoriteClipsService';
import registerRoute from '@/common/api/register';
import LocalOssService from '@/backend/services/LocalOssService';
import { OssObject } from '@/common/types/OssObject';

export default class FavoriteClipsController implements Controller {

    public async addFavoriteClip({videoPath, srtClip}:{ videoPath: string, srtClip: SrtLine[] }) {
        return FavoriteClipsService.addFavoriteClip(videoPath, srtClip);
    }

    public async search(keyword: string):Promise<OssObject[]> {
        return LocalOssService.search(keyword);
    }


    registerRoutes(): void {
        registerRoute('favorite-clips/add', this.addFavoriteClip);
        registerRoute('favorite-clips/search', this.search);
    }

}
