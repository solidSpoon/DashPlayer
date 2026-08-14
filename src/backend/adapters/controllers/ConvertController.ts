import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { FolderVideos } from '@/common/contracts/convert';
import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { VideoInfo } from '@/common/types/video-info';
import ConvertService from '@/backend/application/services/ConvertService';

/**
 * 注册视频转换相关 IPC，并将请求转交给转换用例服务。
 */
@injectable()
export default class ConvertController implements Controller {
    /**
     * 创建转换 IPC Controller。
     * @param convertService 视频转换用例服务。
     */
    constructor(
        @inject(TYPES.ConvertService) private readonly convertService: ConvertService,
    ) {}

    /**
     * 创建视频转换任务。
     * @param file 待转换视频绝对路径。
     * @returns 转换任务 ID。
     */
    public async toMp4(file: string): Promise<number> {
        return this.convertService.startToMp4(file);
    }

    /**
     * 扫描文件夹中的待转换视频。
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的待转换视频集合。
     */
    public async fromFolder(folders: string[]): Promise<FolderVideos[]> {
        return this.convertService.listUnconvertedVideos(folders);
    }

    /**
     * 获取视频时长。
     * @param filePath 视频绝对路径。
     * @returns 视频时长，单位为秒。
     */
    public async videoLength(filePath: string): Promise<number> {
        return this.convertService.getVideoDuration(filePath);
    }

    /**
     * 获取视频媒体信息。
     * @param filePath 视频绝对路径。
     * @returns 视频媒体信息。
     */
    public async videoInfo(filePath: string): Promise<VideoInfo> {
        return this.convertService.getVideoInfo(filePath);
    }

    /**
     * 查找视频对应的 HTML5 MP4 文件。
     * @param filePath 原视频或 HTML5 MP4 文件绝对路径。
     * @returns 已存在的 HTML5 MP4 路径；不存在时返回 `null`。
     */
    public async suggestHtml5Video(filePath: string): Promise<string | null> {
        return this.convertService.suggestHtml5Video(filePath);
    }

    /**
     * 注册转换领域的 IPC 路由。
     */
    public registerRoutes(): void {
        registerRoute('convert/to-mp4', (p) => this.toMp4(p));
        registerRoute('convert/from-folder', (p) => this.fromFolder(p));
        registerRoute('convert/video-length', (p) => this.videoLength(p));
        registerRoute('convert/video-info', (p) => this.videoInfo(p));
        registerRoute('convert/suggest-html5-video', (p) => this.suggestHtml5Video(p));
    }
}
