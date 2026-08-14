import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/adapters/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import SplitVideoService, {
    SplitVideoRequest,
} from '@/backend/application/services/SplitVideoService';
import MediaService, {
    ThumbnailOptions,
} from '@/backend/application/services/MediaService';
import { ChapterParseResult } from '@/common/types/chapter-result';

/**
 * 注册视频切分、缩略图和时长相关 IPC 路由。
 */
@injectable()
export default class MediaController implements Controller {
    public constructor(
        @inject(TYPES.SplitVideoService)
        private readonly splitVideoService: SplitVideoService,
        @inject(TYPES.MediaService)
        private readonly mediaService: MediaService,
    ) {}

    /**
     * 解析章节文本供界面预览。
     * @param chapterText 用户输入的章节文本。
     * @returns 解析后的章节列表。
     */
    public async previewSplit(chapterText: string): Promise<ChapterParseResult[]> {
        return this.splitVideoService.previewSplit(chapterText);
    }

    /**
     * 按章节切分视频和可选字幕。
     * @param request 视频切分请求。
     * @returns 分段文件所在目录。
     */
    public async split(request: SplitVideoRequest): Promise<string> {
        return this.splitVideoService.splitByChapters(request);
    }

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
    public videoLength(filePath: string): Promise<number> {
        return this.mediaService.duration(filePath);
    }

    /**
     * 注册媒体相关 IPC 路由。
     */
    public registerRoutes(): void {
        registerRoute('split-video/preview', (params) => this.previewSplit(params));
        registerRoute('split-video/split', (params) => this.split(params));
        registerRoute('split-video/thumbnail', (params) => this.thumbnail(params));
        registerRoute('split-video/video-length', (params) => this.videoLength(params));
    }
}
