import registerRoute from '@/backend/controllers/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import type Controller from '@/backend/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import type MediaService from '@/backend/services/MediaService';
import { type ThumbnailOptions } from '@/backend/services/MediaService';
import type { VideoInfo } from '@/common/types/video-info';

/**
 * 注册通用媒体 IPC 路由。
 */
@injectable()
export default class MediaController implements Controller {
    public constructor(
        @inject(TYPES.MediaService)
        private readonly mediaService: MediaService,
    ) {}

    /**
     * 获取或生成视频缩略图。
     * @param request 视频路径、截图时间和图片选项。
     * @returns 缩略图文件绝对路径。
     */
    public async thumbnail(request: {
        filePath: string;
        time: number;
        quality?: ThumbnailOptions['quality'];
        width?: number;
        format?: ThumbnailOptions['format'];
    }): Promise<string> {
        const { filePath, time, quality = 'medium', width, format = 'jpg' } = request;
        return this.mediaService.thumbnail(filePath, time, { quality, width, format });
    }

    /**
     * 获取视频时长。
     * @param filePath 视频文件绝对路径。
     * @returns 视频时长，单位为秒。
     */
    public duration(filePath: string): Promise<number> {
        return this.mediaService.duration(filePath);
    }

    /**
     * 获取视频媒体信息。
     * @param filePath 视频文件绝对路径。
     * @returns FFprobe 解析后的媒体信息。
     */
    public info(filePath: string): Promise<VideoInfo> {
        return this.mediaService.info(filePath);
    }

    /**
     * 注册媒体相关 IPC 路由。
     */
    public registerRoutes(): void {
        registerRoute('media/thumbnail', (params) => this.thumbnail(params));
        registerRoute('media/duration', (params) => this.duration(params));
        registerRoute('media/info', (params) => this.info(params));
    }
}
