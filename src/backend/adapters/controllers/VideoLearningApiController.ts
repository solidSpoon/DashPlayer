import { VideoLearningService } from '@/backend/application/services/VideoLearningService';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/adapters/controllers/Controller';

@injectable()
export default class VideoLearningApiController implements Controller {
    @inject(TYPES.VideoLearningService)
    private videoLearningService!: VideoLearningService;

    constructor() {
        this.registerApis();
    }

    registerRoutes(): void {
        // 方法已在构造函数中通过 registerApis() 调用
    }

    private registerApis() {
        registerRoute('video-learning/detect-clip-status', async (params) => {
            const { videoPath, srtKey, srtPath } = params;
            const result = await this.videoLearningService.detectClipStatus(videoPath, srtKey, srtPath);
            return result;
        });

        registerRoute('video-learning/auto-clip', async (params) => {
            const { videoPath, srtKey, srtPath } = params;
            await this.videoLearningService.autoClip(videoPath, srtKey, srtPath);
            return { success: true };
        });

        registerRoute('video-learning/cancel-add', async (params) => {
            const { srtKey, indexInSrt } = params;
            await this.videoLearningService.cancelAddLearningClip(srtKey, indexInSrt);
            return { success: true };
        });

        registerRoute('video-learning/delete', async (params) => {
            const { key } = params;
            await this.videoLearningService.deleteLearningClip(key);
            return { success: true };
        });


        registerRoute('video-learning/search', async (params) => {
            const result = await this.videoLearningService.search(params);
            return { success: true, data: result };
        });


        registerRoute('video-learning/sync-from-oss', async () => {
            await this.videoLearningService.syncFromOss();
            return { success: true };
        });

        registerRoute('video-learning/clip-counts', async () => {
            const data = await this.videoLearningService.countClipsGroupedByWord();
            return { success: true, data };
        });
    }
}
