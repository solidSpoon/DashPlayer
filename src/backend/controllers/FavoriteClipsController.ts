import Controller from '@/backend/interfaces/controller';
import { SrtLine } from '@/common/utils/SrtUtil';
import FavoriteClipsService from '@/backend/services/FavoriteClipsService';
import registerRoute from '@/common/api/register';

export default class FavoriteClipsController implements Controller {

    public async addFavoriteClip({videoPath, srtClip}:{ videoPath: string, srtClip: SrtLine[] }) {
        return FavoriteClipsService.addFavoriteClip(videoPath, srtClip);
    }


    registerRoutes(): void {
        registerRoute('favorite-clips/add', this.addFavoriteClip);
    }

}
