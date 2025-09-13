import { VideoLearningService } from '@/backend/services/VideoLearningService';
import registerRoute from '@/common/api/register';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/interfaces/controller';

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
        registerRoute('video-learning/auto-clip', async (params) => {
            const { videoPath, srtKey } = params;
            await this.videoLearningService.autoClip(videoPath, srtKey);
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

        registerRoute('video-learning/exists', async (params) => {
            const { srtKey, linesInSrt } = params;
            const result = await this.videoLearningService.exists(srtKey, linesInSrt);
            return { success: true, data: result };
        });

        registerRoute('video-learning/search', async (params) => {
            const result = await this.videoLearningService.search(params);
            return { success: true, data: result };
        });

        registerRoute('video-learning/search-by-words', async (params) => {
            const { words } = params;
            const result = await this.videoLearningService.searchByWords(words);
            return { success: true, data: result };
        });

        registerRoute('video-learning/query-tags', async (params) => {
            const { key } = params;
            const result = await this.videoLearningService.queryClipTags(key);
            return { success: true, data: result };
        });

        registerRoute('video-learning/add-tag', async (params) => {
            const { key, tagId } = params;
            await this.videoLearningService.addClipTag(key, tagId);
            return { success: true };
        });

        registerRoute('video-learning/delete-tag', async (params) => {
            const { key, tagId } = params;
            await this.videoLearningService.deleteClipTag(key, tagId);
            return { success: true };
        });

        registerRoute('video-learning/rename-tag', async (params) => {
            const { tagId, newName } = params;
            await this.videoLearningService.renameTag(tagId, newName);
            return { success: true };
        });

        registerRoute('video-learning/task-info', async () => {
            const result = this.videoLearningService.taskInfo();
            return { success: true, data: result };
        });

        registerRoute('video-learning/sync-from-oss', async () => {
            await this.videoLearningService.syncFromOss();
            return { success: true };
        });
    }
}