import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { requestVideoThumbnail } from '@/fronted/lib/video-thumbnail';
import {
    PlaybackEvidenceInput,
    PlaybackRepairDiscardRequest,
    PlaybackRepairStartRequest,
    RepairEnqueueRequest,
} from '@/common/contracts/playback-repair';

export const repairApi = {
    /**
     * 打开文件选择器并返回用户选中的待修复文件。
     *
     * @param formats 允许选择的文件扩展名。
     * @returns 用户选中的文件绝对路径。
     */
    selectFiles: (formats: string[]) => backendClient.call('system/select-file', formats),

    /**
     * 打开文件夹选择器并返回用户选中的目录。
     *
     * @returns 用户选中的文件夹绝对路径。
     */
    selectFolders: () => backendClient.call('system/select-folder', {}),

    /**
     * 列出目录里的全部媒体文件。
     *
     * 不做「需不需要修复」的判断：那要逐个探测（按扩展名猜会得出错误结论）。
     *
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 按文件夹分组的媒体文件。
     */
    listFolderVideos: (folders: string[]) => backendClient.call('repair/list-folder-videos', folders),

    /**
     * 查询修复名单，按组返回。
     *
     * 组只是标记：同一个文件可以出现在多个组里，状态只有一份，因此播放页发起的修复
     * 也在这里按同一条记录显示。
     *
     * @returns 各组及其媒体。
     */
    listGroups: () => backendClient.call('repair/groups'),

    /**
     * 把媒体加入修复名单。
     *
     * @param request 分组信息与媒体路径列表。
     */
    enqueueTasks: (request: RepairEnqueueRequest) => backendClient.call('repair/enqueue', request),

    /**
     * 探测单个媒体是否需要修复，并把结论写进记录。
     *
     * @param file 媒体绝对路径。
     * @returns 诊断结论。
     */
    probe: (file: string) => backendClient.call('repair/probe', file),

    /**
     * 删除修复记录。
     *
     * @param file 媒体绝对路径。
     */
    removeTask: (file: string) => backendClient.call('repair/remove-task', file),

    /**
     * 删除整组标记。
     *
     * @param groupKey 组标识。
     */
    removeGroup: (groupKey: string) => backendClient.call('repair/remove-group', groupKey),

    /**
     * 诊断单个媒体文件是否需要修复。
     *
     * @param file 待诊断媒体绝对路径。
     * @returns 诊断结论；已修复时 `needsRepair` 为 false。
     */
    diagnose: (file: string) => backendClient.call('repair/diagnose', file),

    /**
     * 诊断并启动单个媒体的修复任务。
     *
     * @param request 待修复媒体与可选的强制配方。
     * @returns 是否已启动修复与诊断结论；无需修复时未启动。
     * 进度与终态经 `repair-task-update` 事件按媒体路径推送。
     */
    startRepair: (request: PlaybackRepairStartRequest) => backendClient.call('repair/start', request),

    /**
     * 丢弃某个媒体的修复产物。
     *
     * 用于产物在真机试播验收中仍不可播的场景：产物留着会被后续播放优先选中。
     *
     * @param request 源媒体与产物绝对路径。
     * @returns 产物存在并被删除时返回 true。
     */
    discard: (request: PlaybackRepairDiscardRequest) => backendClient.call('repair/discard', request),

    /**
     * 查询是否还需要对这两个编码做真机能力探测。
     *
     * 探测约耗 1.6s 隐藏试播，后端只在编码从未有过实测结论时返回 true。
     *
     * @param payload 待探测的视频/音频编码；无对应流时传 null。
     * @returns 需要探测时返回 true。
     */
    shouldProbeCapability: (payload: { videoCodec: string | null; audioCodec: string | null }) =>
        backendClient.call('repair/should-probe-capability', payload),

    /**
     * 上报一次结论性播放证据到学习缓存。
     *
     * 非结论性证据（试播没跑起来）会被后端忽略。
     *
     * @param payload 证据内容。
     */
    recordPlaybackEvidence: (payload: PlaybackEvidenceInput) =>
        backendClient.call('repair/record-playback-evidence', payload),

    /**
     * 获取媒体指定时间点的缩略图。
     *
     * @param filePath 媒体绝对路径。
     * @param time 截图时间，单位为秒。
     * @returns 缩略图文件路径。
     */
    getThumbnail: (filePath: string, time: number) => requestVideoThumbnail({ filePath, time }),

    /**
     * 获取媒体时长。
     *
     * @param file 媒体绝对路径。
     * @returns 媒体时长，单位为秒。
     */
    getDuration: (file: string) => backendClient.call('media/duration', file),

    /**
     * 取消正在运行的修复任务。
     *
     * 没有修复在运行时是无操作：界面上的「进行中」可能只是尚未刷新的旧记录。
     *
     * @param file 待取消修复的媒体绝对路径。
     */
    cancel: (file: string) => backendClient.call('repair/cancel', file),

    /**
     * 在系统文件管理器中显示指定路径。
     *
     * @param path 文件或文件夹绝对路径。
     * @returns 文件管理器打开后结束。
     */
    openFolder: (path: string) => backendClient.call('system/open-folder', { path }),
};
