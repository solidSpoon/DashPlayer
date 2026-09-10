import registerRoute from '@/backend/controllers/ipc/registerRoute';
import {
    FolderVideos,
    PlaybackRepairDiagnosis,
    PlaybackRepairStartResult,
} from '@/common/contracts/playback-repair';
import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import PlaybackRepairService from '@/backend/services/PlaybackRepairService';

/**
 * 注册播放修复相关 IPC，并将请求转交给修复用例服务。
 */
@injectable()
export default class PlaybackRepairController implements Controller {
    /**
     * 创建播放修复 IPC Controller。
     * @param playbackRepairService 播放修复用例服务。
     */
    constructor(
        @inject(TYPES.PlaybackRepairService) private readonly playbackRepairService: PlaybackRepairService,
    ) {}

    /**
     * 诊断媒体文件是否需要修复。
     * @param file 待诊断媒体绝对路径。
     * @returns 诊断结论。
     */
    public async diagnose(file: string): Promise<PlaybackRepairDiagnosis> {
        return this.playbackRepairService.diagnose(file);
    }

    /**
     * 诊断并启动修复任务。
     * @param file 待修复媒体绝对路径。
     * @returns 任务编号与诊断结论。
     */
    public async startRepair(file: string): Promise<PlaybackRepairStartResult> {
        return this.playbackRepairService.startRepair(file);
    }

    /**
     * 扫描文件夹中的待修复媒体。
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的待修复媒体集合。
     */
    public async scanFolders(folders: string[]): Promise<FolderVideos[]> {
        return this.playbackRepairService.listRepairableVideos(folders);
    }

    /**
     * 丢弃某个媒体的修复产物。
     * @param file 原媒体或产物绝对路径。
     * @returns 产物存在并被删除时返回 true。
     */
    public async discard(file: string): Promise<boolean> {
        return this.playbackRepairService.discardRepairOutput(file);
    }

    /**
     * 注册播放修复领域的 IPC 路由。
     */
    public registerRoutes(): void {
        registerRoute('repair/diagnose', (p) => this.diagnose(p));
        registerRoute('repair/start', (p) => this.startRepair(p));
        registerRoute('repair/scan-folders', (p) => this.scanFolders(p));
        registerRoute('repair/discard', (p) => this.discard(p));
    }
}
