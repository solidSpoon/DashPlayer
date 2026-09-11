import registerRoute from '@/backend/controllers/ipc/registerRoute';
import {
    FolderVideos,
    PlaybackEvidenceInput,
    PlaybackRepairDiagnosis,
    PlaybackRepairDiscardRequest,
    PlaybackRepairStartRequest,
    PlaybackRepairStartResult,
    RepairEnqueueRequest,
    RepairEnqueueResult,
    RepairGroup,
} from '@/common/contracts/playback-repair';
import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import PlaybackRepairService from '@/backend/services/PlaybackRepairService';
import PlaybackCapabilityService from '@/backend/services/PlaybackCapabilityService';

/**
 * 注册播放修复相关 IPC，并将请求转交给修复用例服务。
 */
@injectable()
export default class PlaybackRepairController implements Controller {
    /**
     * 创建播放修复 IPC Controller。
     * @param playbackRepairService 播放修复用例服务。
     * @param playbackCapabilityService 播放能力学习缓存服务。
     */
    constructor(
        @inject(TYPES.PlaybackRepairService) private readonly playbackRepairService: PlaybackRepairService,
        @inject(TYPES.PlaybackCapabilityService) private readonly playbackCapabilityService: PlaybackCapabilityService,
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
     * @param request 待修复媒体与可选的强制配方。
     * @returns 任务编号与诊断结论。
     */
    public async startRepair(request: PlaybackRepairStartRequest): Promise<PlaybackRepairStartResult> {
        return this.playbackRepairService.startRepair(request);
    }

    /**
     * 列出文件夹里的全部媒体文件。
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的媒体集合。
     */
    public async listFolderVideos(folders: string[]): Promise<FolderVideos[]> {
        return this.playbackRepairService.listFolderVideos(folders);
    }

    /**
     * 把媒体加入修复名单。
     * @param request 分组信息与媒体路径列表。
     */
    public async enqueueRepairTasks(request: RepairEnqueueRequest): Promise<RepairEnqueueResult> {
        return this.playbackRepairService.enqueueRepairTasks(request);
    }

    /**
     * 查询修复名单，按组返回。
     * @returns 各组及其媒体。
     */
    public async listRepairGroups(): Promise<RepairGroup[]> {
        return this.playbackRepairService.listRepairGroups();
    }

    /**
     * 探测单个媒体是否需要修复，并把结论写进记录。
     * @param filePath 媒体绝对路径。
     * @returns 诊断结论。
     */
    public async probeRepairTask(filePath: string): Promise<PlaybackRepairDiagnosis> {
        return this.playbackRepairService.probeRepairTask(filePath);
    }

    /**
     * 删除整组修复名单标记。
     * @param groupKey 组标识。
     */
    public async removeRepairGroup(groupKey: string): Promise<void> {
        return this.playbackRepairService.removeRepairGroup(groupKey);
    }

    /**
     * 删除修复记录。
     * @param filePath 媒体绝对路径。
     */
    public async removeRepairTask(filePath: string): Promise<void> {
        return this.playbackRepairService.removeRepairTask(filePath);
    }

    /**
     * 丢弃某个媒体的修复产物。
     * @param request 源媒体与产物绝对路径。
     * @returns 产物存在并被删除时返回 true。
     */
    public async discard(request: PlaybackRepairDiscardRequest): Promise<boolean> {
        return this.playbackRepairService.discardRepairOutput(request);
    }

    /**
     * 查询是否还需要对这两个编码做真机能力探测。
     *
     * @param payload 待探测的编码；无对应流时传 null。
     * @returns 任一编码从未有过实测结论时返回 true。
     */
    public async shouldProbeCapability(
        payload: { videoCodec: string | null; audioCodec: string | null },
    ): Promise<boolean> {
        return this.playbackCapabilityService.shouldProbeCapability(payload.videoCodec, payload.audioCodec);
    }

    /**
     * 记录一次结论性播放证据到学习缓存。
     *
     * @param payload 渲染端真机探测/真实播放得到的证据。
     */
    public async recordPlaybackEvidence(payload: PlaybackEvidenceInput): Promise<void> {
        await this.playbackCapabilityService.recordEvidence(payload);
    }

    /**
     * 注册播放修复领域的 IPC 路由。
     */
    public registerRoutes(): void {
        registerRoute('repair/diagnose', (p) => this.diagnose(p));
        registerRoute('repair/start', (p) => this.startRepair(p));
        registerRoute('repair/list-folder-videos', (p) => this.listFolderVideos(p));
        registerRoute('repair/groups', () => this.listRepairGroups());
        registerRoute('repair/probe', (p) => this.probeRepairTask(p));
        registerRoute('repair/remove-group', (p) => this.removeRepairGroup(p));
        registerRoute('repair/enqueue', (p) => this.enqueueRepairTasks(p));
        registerRoute('repair/remove-task', (p) => this.removeRepairTask(p));
        registerRoute('repair/discard', (p) => this.discard(p));
        registerRoute('repair/should-probe-capability', (p) => this.shouldProbeCapability(p));
        registerRoute('repair/record-playback-evidence', (p) => this.recordPlaybackEvidence(p));
    }
}
