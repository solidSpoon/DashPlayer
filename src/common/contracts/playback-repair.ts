/**
 * 播放修复相关的跨进程契约。
 *
 * 术语约定：
 * - 诊断（diagnose）：判断一个媒体文件在当前播放器里会不会出问题；
 * - 配方（recipe）：诊断出问题后实际执行的 ffmpeg 处理方式；
 * - 修复产物：处理结果文件，命名规则为「原文件名 + `.html5` + 容器后缀」，与源文件同目录。
 */

/**
 * MP3 码率模式。
 *
 * VBR（可变码率）的帧字节数随码率变化，「时间 → 字节偏移」没有唯一解，
 * 浏览器只能靠 Xing TOC（仅 100 个采样点）估算，seek 落点会偏差到秒级。
 */
export type Mp3BitrateMode = 'vbr' | 'cbr' | 'unknown';

/**
 * 修复配方。
 *
 * - `remux-copy`：只换容器，音视频流原样搬运；
 * - `video-copy-audio-transcode`：视频流原样搬运，音频重编码为 AAC；
 * - `full-transcode`：整片重编码为 H.264 + AAC；
 * - `audio-transcode`：纯音频文件重编码为 AAC + M4A 容器。
 */
export type RepairRecipe =
    | 'remux-copy'
    | 'video-copy-audio-transcode'
    | 'full-transcode'
    | 'audio-transcode';

/**
 * 诊断结论的原因，界面据此选择文案。
 *
 * - `already-repaired`：修复产物已存在，无需重复处理；
 * - `playable`：当前播放器可直接播放；
 * - `unsupported-container`：容器打不开（如 AVI/FLV/WMV/WMA）；
 * - `undecodable-video`：视频编码无法解码（如 MPEG-4 Part 2、WMV2）；
 * - `unsupported-audio`：音频编码放不出声（如 DTS/AC3/EAC3）；
 * - `mp3-seek-imprecise`：VBR MP3 缺少逐帧索引，seek 会落到几秒外。
 */
export type RepairReason =
    | 'already-repaired'
    | 'playable'
    | 'unsupported-container'
    | 'undecodable-video'
    | 'unsupported-audio'
    | 'mp3-seek-imprecise';

/**
 * 修复记录状态。
 *
 * 额外增加 `discarded`：用户主动丢弃了修复产物。
 * 状态只描述「这个媒体修过什么」，不代表产物现在还在或能不能播——那些一律看磁盘上的文件。
 */
export enum RepairTaskState {
    /** 已加入名单，等待探测（还没判断出需不需要修）。 */
    INIT = 'init',
    /** 探测完成，已确认需要修复；`reason` 说明问题类型。 */
    TODO = 'todo',
    /** 正在修复。 */
    IN_PROGRESS = 'in_progress',
    /** 修复完成或本来无需修复。 */
    DONE = 'done',
    /** 被取消（含应用重启导致的中断）。 */
    CANCELLED = 'cancelled',
    /** 修复失败。 */
    FAILED = 'failed',
    /** 用户已经丢弃了修复产物。 */
    DISCARDED = 'discarded',
}

/**
 * 修复记录的更新内容。
 */
export interface RepairTaskUpdatePatch {
    /** 新状态。 */
    status: RepairTaskState;
    /** 本次采用的配方。 */
    recipe?: RepairRecipe | null;
    /** 修复产物路径。 */
    outputPath?: string | null;
    /** 诊断原因。 */
    reason?: RepairReason | null;
    /** 失败原因。 */
    error?: string | null;
}

/**
 * 修复任务推送给渲染端的实时事件。
 *
 * 媒体路径是事件与修复记录的关联键。进度只存在于事件里，不落库：页面重开后
 * 进行中的记录只显示「正在修复」，不带百分比。
 */
export interface RepairTaskEvent {
    /** 媒体绝对路径。 */
    file: string;
    /** 当前修复状态。 */
    status: RepairTaskState;
    /** 当前进度（0 到 100）；仅进行中事件有意义。 */
    progress?: number;
    /** 失败或取消原因。 */
    error?: string;
}

/**
 * 丢弃修复产物的请求。
 *
 * 两个路径都要带上：产物路径决定删哪个文件，源媒体路径决定更新哪条记录。
 */
export interface PlaybackRepairDiscardRequest {
    /** 被丢弃的修复产物绝对路径。 */
    outputPath: string;
    /** 该产物对应的源媒体绝对路径。 */
    filePath: string;
}

/**
 * 修复名单分组的来源类型。
 *
 * 组只是标记：界面按来源渲染标题（文件夹路径 / 「手动添加的 N 个」），不把界面文案写进数据库。
 */
export type RepairGroupSource = 'folder' | 'files';

/**
 * 一组修复名单（纯标记）。
 *
 * 文件状态只有一份，所以同一个文件可以同时属于多个组；在任意组里修复它，
 * 其它组都会显示同一条最新状态。
 */
export interface RepairGroup {
    /** 组标识；空字符串表示未归组（例如从播放页发起的修复）。 */
    key: string;
    /** 组来源；未归组时为 `files`。 */
    source: RepairGroupSource;
    /** 文件夹来源时对应的目录绝对路径。 */
    path?: string;
    /** 组内媒体的当前修复记录。 */
    tasks: RepairTask[];
}

/**
 * 把媒体加入修复名单的请求。
 */
export interface RepairEnqueueRequest {
    /** 组来源类型。 */
    source: RepairGroupSource;
    /** 文件夹来源时的目录绝对路径。 */
    path?: string;
    /** 组内媒体绝对路径列表。 */
    filePaths: string[];
}

/**
 * 启动修复的请求。
 */
export interface PlaybackRepairStartRequest {
    /** 待修复媒体绝对路径。 */
    filePath: string;
    /**
     * 强制使用指定配方，跳过「需不需要修」的判断。
     *
     * 用于用户认为文件仍有问题、而诊断判定「无需修复」的场景（如卡顿、音画不同步）。
     * 不传时按诊断结果自动选配方。
     */
    forceRecipe?: RepairRecipe;
}

/**
 * 加入修复名单的结果。
 */
export interface RepairEnqueueResult {
    /** 后端算出的组标识。 */
    groupKey: string;
    /**
     * 本次真正新加入这一组的媒体。
     *
     * 为空表示这批文件已经全在名单里（完全重复的选择），界面据此提示一句而不是再造一张卡片。
     */
    addedFiles: string[];
}

/**
 * 一条播放修复记录。
 */
export interface RepairTask {
    /** 被修复的媒体绝对路径。 */
    file: string;
    /** 修复状态；缺省表示尚未开始。 */
    status?: RepairTaskState;
    /** 本次采用的修复配方。 */
    recipe?: RepairRecipe;
    /** 修复产物路径。 */
    outputPath?: string;
    /** 诊断原因，用于区分「本来就无需修复」与「已修复」。 */
    reason?: RepairReason;
    /** 失败原因。 */
    error?: string;
    /** 入队时间（UTC 数据库时间字符串）。 */
    created_at: string;
    /** 最近更新时间（UTC 数据库时间字符串）。 */
    updated_at: string;
}

/**
 * 单个媒体文件的播放修复诊断结果。
 */
export interface PlaybackRepairDiagnosis {
    /** 被诊断的媒体绝对路径。 */
    filePath: string;
    /** 是否需要修复。 */
    needsRepair: boolean;
    /** 诊断结论原因。 */
    reason: RepairReason;
    /** 需要修复时给出的配方；已修复时为空。 */
    recipe?: RepairRecipe;
    /** 修复产物路径；需要修复时为将要生成的路径，已修复时为既有产物路径。 */
    outputPath?: string;
    /** 探测到的视频编码，便于界面与日志排障。 */
    videoCodec?: string;
    /** 探测到的音频编码。 */
    audioCodec?: string;
    /** 源文件是否包含视频流；修复后验收时用来判断应该解出画面。 */
    hasVideoStream: boolean;
    /** 源文件是否包含音轨；修复后验收时用来判断应该解出声音。 */
    hasAudioStream: boolean;
    /** MP3 的码率模式；非 MP3 文件为空。 */
    mp3BitrateMode?: Mp3BitrateMode;
}

/**
 * 启动修复的返回结果。
 */
export interface PlaybackRepairStartResult {
    /**
     * 修复是否已在本进程内运行；无需修复时为 `false`。
     *
     * 同一媒体已有修复在运行时返回的是那条正在运行的修复，调用方按媒体路径订阅
     * `RepairTaskEvent` 接管进度即可，不要再启动新的修复（产物路径固定，两次修复会互相覆盖）。
     */
    started: boolean;
    /** 本次诊断结果，界面据此展示「已修复 / 无需修复」文案。 */
    diagnosis: PlaybackRepairDiagnosis;
}

/**
 * 文件夹扫描结果。
 */
export interface FolderVideos {
    /** 被扫描的文件夹绝对路径。 */
    folder: string;
    /** 该文件夹内待修复的媒体文件绝对路径。 */
    videos: string[];
}

/**
 * 单个编码的实测结论。
 *
 * - `playable`：真机探测确认解出了画面/声音，只用于避免重复探测；
 * - `unplayable`：真机探测确认解不出，诊断据此收紧修复配方。
 *
 * 学习层只收紧不放松：`playable` 永远不会把白名单外的编码变成可搬。
 */
export type LearnedCodecVerdict = 'playable' | 'unplayable';

/**
 * 渲染端上报的一次结论性播放证据。
 */
export interface PlaybackEvidenceInput {
    /** ffprobe 报告的编码名（如 hevc、aac）。 */
    codec: string;
    /** 证据所属的流类型。 */
    kind: 'video' | 'audio';
    /** 实测该编码是否解出了画面/声音。 */
    playable: boolean;
    /** 证据是否结论性：容器已解析且播放确实推进；非结论性证据会被忽略。 */
    conclusive: boolean;
    /** 产生证据的媒体文件绝对路径，用于排障与将来的同源去重。 */
    sourceFile: string;
}

/**
 * 诊断时可用的学习覆盖层：只包含本次诊断涉及编码的实测结论。
 *
 * 字段缺省表示该编码没有学习结论，诊断完全回落静态白名单。
 */
export interface LearnedCapabilityOverlay {
    /** 视频编码的实测结论。 */
    video?: LearnedCodecVerdict;
    /** 音频编码的实测结论。 */
    audio?: LearnedCodecVerdict;
}
