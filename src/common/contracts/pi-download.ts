/**
 * Pi 下载会话状态。
 */
export type PiDownloadSessionStatus = 'starting' | 'running' | 'idle' | 'aborted' | 'error' | 'closed';

/**
 * 下载任务语义阶段。
 */
export type PiDownloadPhase =
    | 'checking_env'
    | 'analyzing'
    | 'downloading'
    | 'postprocessing'
    | 'completed'
    | 'error';

/**
 * 实时下载进度信息。
 */
export interface PiDownloadProgressInfo {
    /** 当前所处阶段。 */
    phase: PiDownloadPhase;
    /** 进度百分比（0-100）；无明确百分比的阶段为 null。 */
    percent: number | null;
    /** 阶段或速率详情文案（如速度、ETA、当前操作说明）。 */
    detail?: string;
}

/**
 * 对话流中的媒体下载 / 结果卡片信息。
 */
export interface PiDownloadMediaCardInfo {
    /** 卡片状态：downloading（下载中）或 ready（已完成可播放）。 */
    state: 'downloading' | 'ready';
    /** 视频标题或文件名。 */
    title: string;
    /** 最终落盘的视频文件绝对路径（ready 时存在）。 */
    videoPath?: string;
    /** 关联字幕文件绝对路径（可选）。 */
    subtitlePath?: string;
    /** 分辨率标签（如 1080p）。 */
    resolution?: string;
    /** 时长文本（如 04:26）。 */
    durationText?: string;
    /** 下载百分比（0-100，仅 downloading 时使用）。 */
    percent?: number | null;
    /** 速率/大小/ETA 说明（仅 downloading 时使用）。 */
    detail?: string;
}

/**
 * 下载任务交互提问选项。
 */
export interface PiDownloadChoiceOption {
    /** 选项唯一标识值（回传给 Agent）。 */
    value: string;
    /** 面向用户展示的主文案。 */
    label: string;
    /** 可选的补充说明（如时长、编号、来源等）。 */
    description?: string;
}

/**
 * 对话流中的交互提问卡片（由 `ask_user` 工具生成）。
 */
export interface PiDownloadChoiceCardInfo {
    /** 本次提问的唯一标识（与 toolCallId 对应）。 */
    choiceId: string;
    /** 提问标题。 */
    question: string;
    /** 可选的补充说明。 */
    description?: string;
    /** 选择模式：single（单选）或 multiple（多选）。 */
    selectionMode: 'single' | 'multiple';
    /** 可选项列表。 */
    options: PiDownloadChoiceOption[];
    /** 确认按钮文案（可选）。 */
    confirmLabel?: string;
    /** 用户已提交的选择值列表；非空表示该卡片已作答并进入只读态。 */
    selectedValues?: string[];
}

/**
 * 下载工作台基础上下文（包含输出目录与云端 AI 就绪状态）。
 */
export interface PiDownloadContextVO {
    /** 默认最终视频保存目录。 */
    videosDir: string;
    /** 下载 Agent 所需的云端 AI 凭据与模型是否已就绪。 */
    aiReady: boolean;
    /** 云端 AI 未就绪时的明确提示信息。 */
    aiIssue?: string;
}

/**
 * 对话流中的消息条目（前后端持久化共用结构）。
 */
export type PiDownloadTimelineItem =
    | {
        id: string;
        kind: 'system';
        text: string;
    }
    | {
        id: string;
        kind: 'user';
        text: string;
        isInitialPrompt: boolean;
        timestamp: number;
    }
    | {
        id: string;
        kind: 'assistant';
        text: string;
        thinking: string;
        streaming: boolean;
    }
    | {
        id: string;
        kind: 'tool';
        toolCallId: string;
        toolName: string;
        args?: unknown;
        output: string;
        status: 'running' | 'success' | 'error';
    }
    | {
        id: string;
        kind: 'media_card';
        card: PiDownloadMediaCardInfo;
    }
    | {
        id: string;
        kind: 'choice_card';
        card: PiDownloadChoiceCardInfo;
    }
    | {
        id: string;
        kind: 'stderr';
        text: string;
    };

/**
 * Pi 下载会话摘要信息。
 */
export interface PiDownloadSessionVO {
    /** 会话唯一标识。 */
    sessionId: string;
    /** 展示标题（视频就绪后自动填充视频标题）。 */
    title?: string;
    /** 用户输入的目标链接。 */
    url: string;
    /** 本次任务持久化的独立工作目录（pi 进程 cwd）。 */
    workspaceDir: string;
    /** 应用配置的最终视频存储目录。 */
    videosDir: string;
    /** 当前会话状态。 */
    status: PiDownloadSessionStatus;
    /** 当前阶段与下载进度。 */
    progress: PiDownloadProgressInfo | null;
    /** 创建时间戳（毫秒）。 */
    createdAt: number;
    /** 最近更新时间戳（毫秒）。 */
    updatedAt: number;
}

/**
 * Pi 下载会话完整详情（含持久化对话时间线）。
 */
export interface PiDownloadSessionDetailVO {
    /** 会话摘要。 */
    session: PiDownloadSessionVO;
    /** 持久化的对话与工具执行时间线。 */
    items: PiDownloadTimelineItem[];
    /** 最近一次错误信息（无错误时为 null）。 */
    error: string | null;
}

/**
 * 启动 Pi 下载任务请求。
 */
export interface PiDownloadStartRequest {
    /** 要下载的目标链接。 */
    url: string;
    /** 本次会话指定的最终保存目录；不传时使用应用默认视频目录。 */
    outputDir?: string;
}

/**
 * 向正在运行的 Pi 下载会话发送用户消息请求。
 */
export interface PiDownloadSendMessageRequest {
    /** 会话唯一标识。 */
    sessionId: string;
    /** 用户补充的指令文本。 */
    message: string;
    /** 若本次消息来自交互选择卡片，附带卡片 ID 与已选值以持久化锁定卡片状态。 */
    choiceReply?: {
        choiceId: string;
        selectedValues: string[];
    };
}

/**
 * 针对指定 Pi 下载会话的操作请求。
 */
export interface PiDownloadSessionActionRequest {
    /** 会话唯一标识。 */
    sessionId: string;
}

/**
 * 从 Pi RPC 进程转发到前端的实时事件。
 */
export type PiDownloadStreamEvent =
    | {
        sessionId: string;
        kind: 'status';
        status: PiDownloadSessionStatus;
        error?: string;
    }
    | {
        sessionId: string;
        kind: 'system_prompt';
        text: string;
    }
    | {
        sessionId: string;
        kind: 'user_message';
        text: string;
        timestamp: number;
    }
    | {
        sessionId: string;
        kind: 'assistant_start';
    }
    | {
        sessionId: string;
        kind: 'assistant_text_delta';
        delta: string;
    }
    | {
        sessionId: string;
        kind: 'assistant_thinking_delta';
        delta: string;
    }
    | {
        sessionId: string;
        kind: 'assistant_end';
    }
    | {
        sessionId: string;
        kind: 'tool_start';
        toolCallId: string;
        toolName: string;
        args?: unknown;
    }
    | {
        sessionId: string;
        kind: 'tool_update';
        toolCallId: string;
        toolName: string;
        output: string;
    }
    | {
        sessionId: string;
        kind: 'tool_end';
        toolCallId: string;
        toolName: string;
        output: string;
        isError: boolean;
    }
    | {
        sessionId: string;
        kind: 'progress';
        progress: PiDownloadProgressInfo;
    }
    | {
        sessionId: string;
        kind: 'media_card';
        card: PiDownloadMediaCardInfo;
    }
    | {
        sessionId: string;
        kind: 'choice_card';
        card: PiDownloadChoiceCardInfo;
    }
    | {
        sessionId: string;
        kind: 'stderr';
        text: string;
    };
