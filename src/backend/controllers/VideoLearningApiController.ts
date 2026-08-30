import { VideoLearningService } from '@/backend/services/VideoLearningService';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/controllers/Controller';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';

@injectable()
export default class VideoLearningApiController implements Controller {
    @inject(TYPES.VideoLearningService)
    private videoLearningService!: VideoLearningService;
    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    registerRoutes(): void {
        registerRoute('video-learning/detect-clip-status', async (params) => {
            const { videoPath, srtKey, srtPath } = params;
            const result = await this.videoLearningService.detectClipStatus(videoPath, srtKey, srtPath);
            return result;
        });

        registerRoute('video-learning/clip-queue-status', async () => {
            const result = await this.videoLearningService.getGlobalClipQueueStatus();
            return result;
        });

        registerRoute('video-learning/auto-clip', async (params) => {
            const { videoPath, srtKey, srtPath } = params;
            await this.videoLearningService.autoClip(videoPath, srtKey, srtPath);
            return { success: true };
        });

        registerRoute('video-learning/cancel-auto-clip-all', async () => {
            const clearedCount = await this.videoLearningService.cancelAllAutoClipTasks();
            return { success: true, clearedCount };
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

        registerRoute('video-learning/resolve-clip-vocabulary', async (params) => {
            const data = await this.videoLearningService.resolveClipVocabulary(params.lines, params.words);
            return { success: true, data };
        });


        registerRoute('video-learning/sync-from-oss', async () => {
            await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.WORD_VIDEO);
            await this.videoLearningService.syncFromOss();
            return { success: true };
        });

        registerRoute('video-learning/word-clip-stats', async () => {
            const data = await this.videoLearningService.getWordClipStats();
            return { success: true, data };
        });
    }
}
