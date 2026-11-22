import { create } from 'zustand';
import type {
    PiDownloadProgressInfo,
    PiDownloadSessionDetailVO,
    PiDownloadSessionStatus,
    PiDownloadSessionVO,
    PiDownloadStreamEvent,
    PiDownloadTimelineItem,
} from '@/common/contracts/pi-download';

export type DownloadTimelineItem = PiDownloadTimelineItem;

interface DownloadStoreState {
    /** 历史与活跃会话列表（按创建时间倒序）。 */
    sessions: PiDownloadSessionVO[];
    /** 当前正在查看的下载会话。 */
    session: PiDownloadSessionVO | null;
    /** 当前会话实时时间线条目。 */
    items: DownloadTimelineItem[];
    /** 当前下载阶段与进度信息。 */
    progress: PiDownloadProgressInfo | null;
    /** 最近一次错误说明。 */
    error: string | null;
    /** 设置会话列表。 */
    setSessions: (sessions: PiDownloadSessionVO[]) => void;
    /** 启动新会话并设为当前选中。 */
    setSession: (session: PiDownloadSessionVO | null) => void;
    /** 从持久化详情加载历史或进行中会话。 */
    loadSessionDetail: (detail: PiDownloadSessionDetailVO) => void;
    /** 应用一条来自后端的 Pi RPC 流式事件。 */
    applyStreamEvent: (event: PiDownloadStreamEvent) => void;
    /** 更新会话状态。 */
    setStatus: (status: PiDownloadSessionStatus, error?: string) => void;
    /** 从列表移除会话（若正好选中则清空右侧）。 */
    removeSessionFromList: (sessionId: string) => void;
    /** 清空当前选中会话回到新建态。 */
    reset: () => void;
}

let itemSeq = 0;
const nextItemId = (): string => {
    itemSeq += 1;
    return `dl-item-${itemSeq}`;
};

/**
 * Pi 下载会话前端状态管理。
 */
export const useDownloadStore = create<DownloadStoreState>((set) => ({
    sessions: [],
    session: null,
    items: [],
    progress: null,
    error: null,

    setSessions: (sessions) => {
        set({ sessions });
    },

    setSession: (session) => {
        set((state) => {
            if (!session) {
                return { session: null, items: [], progress: null, error: null };
            }
            const exists = state.sessions.some((item) => item.sessionId === session.sessionId);
            const nextSessions = exists
                ? state.sessions.map((item) => (item.sessionId === session.sessionId ? session : item))
                : [session, ...state.sessions];
            return {
                sessions: nextSessions,
                session,
                items: [],
                progress: session.progress,
                error: null,
            };
        });
    },

    loadSessionDetail: (detail) => {
        set((state) => {
            const exists = state.sessions.some((item) => item.sessionId === detail.session.sessionId);
            const nextSessions = exists
                ? state.sessions.map((item) => (item.sessionId === detail.session.sessionId ? detail.session : item))
                : [detail.session, ...state.sessions];
            return {
                sessions: nextSessions,
                session: detail.session,
                items: detail.items,
                progress: detail.session.progress,
                error: detail.error,
            };
        });
    },

    setStatus: (status, error) => {
        set((state) => ({
            session: state.session ? { ...state.session, status } : null,
            error: error ?? state.error,
        }));
    },

    removeSessionFromList: (sessionId) => {
        set((state) => {
            const nextSessions = state.sessions.filter((item) => item.sessionId !== sessionId);
            if (state.session?.sessionId === sessionId) {
                return {
                    sessions: nextSessions,
                    session: null,
                    items: [],
                    progress: null,
                    error: null,
                };
            }
            return { sessions: nextSessions };
        });
    },

    reset: () => {
        set({
            session: null,
            items: [],
            progress: null,
            error: null,
        });
    },

    applyStreamEvent: (event) => {
        set((state) => {
            const nextSessions = state.sessions.map((item) => {
                if (item.sessionId !== event.sessionId) {
                    return item;
                }
                if (event.kind === 'status') {
                    return { ...item, status: event.status, updatedAt: Date.now() };
                }
                if (event.kind === 'progress') {
                    return { ...item, progress: event.progress, updatedAt: Date.now() };
                }
                return item;
            });

            if (!state.session || state.session.sessionId !== event.sessionId) {
                return { sessions: nextSessions };
            }

            if (event.kind === 'progress') {
                return {
                    sessions: nextSessions,
                    progress: event.progress,
                    session: { ...state.session, progress: event.progress },
                };
            }

            if (event.kind === 'media_card') {
                const nextItems = [...state.items];
                let updatedSessions = nextSessions;

                if (event.card.state === 'ready') {
                    updatedSessions = nextSessions.map((item) => {
                        if (item.sessionId === event.sessionId && !item.title && event.card.title) {
                            return { ...item, title: event.card.title };
                        }
                        return item;
                    });
                    for (let i = nextItems.length - 1; i >= 0; i -= 1) {
                        const item = nextItems[i];
                        if (item.kind === 'media_card' && item.card.state === 'downloading') {
                            nextItems.splice(i, 1);
                        }
                    }
                    const existingIndex = event.card.videoPath
                        ? nextItems.findIndex(
                            (item) => item.kind === 'media_card' && item.card.videoPath === event.card.videoPath,
                        )
                        : -1;
                    if (existingIndex !== -1) {
                        nextItems[existingIndex] = {
                            ...nextItems[existingIndex],
                            kind: 'media_card',
                            card: event.card,
                        };
                    } else {
                        nextItems.push({
                            id: nextItemId(),
                            kind: 'media_card',
                            card: event.card,
                        });
                    }
                    return {
                        sessions: updatedSessions,
                        session: !state.session.title && event.card.title
                            ? { ...state.session, title: event.card.title }
                            : state.session,
                        items: nextItems,
                    };
                }

                let downloadingIndex = -1;
                for (let i = nextItems.length - 1; i >= 0; i -= 1) {
                    const item = nextItems[i];
                    if (item.kind === 'media_card' && item.card.state === 'downloading') {
                        downloadingIndex = i;
                        break;
                    }
                }
                if (downloadingIndex !== -1) {
                    nextItems[downloadingIndex] = {
                        ...nextItems[downloadingIndex],
                        kind: 'media_card',
                        card: event.card,
                    };
                } else {
                    nextItems.push({
                        id: nextItemId(),
                        kind: 'media_card',
                        card: event.card,
                    });
                }
                return {
                    sessions: updatedSessions,
                    items: nextItems,
                };
            }

            if (event.kind === 'status') {
                return {
                    sessions: nextSessions,
                    session: { ...state.session, status: event.status },
                    error: event.error ?? (event.status === 'running' ? null : state.error),
                };
            }

            if (event.kind === 'system_prompt') {
                return {
                    sessions: nextSessions,
                    items: [
                        ...state.items,
                        {
                            id: nextItemId(),
                            kind: 'system',
                            text: event.text,
                        },
                    ],
                };
            }

            if (event.kind === 'user_message') {
                return {
                    sessions: nextSessions,
                    items: [
                        ...state.items,
                        {
                            id: nextItemId(),
                            kind: 'user',
                            text: event.text,
                            isInitialPrompt: false,
                            timestamp: event.timestamp,
                        },
                    ],
                };
            }

            if (event.kind === 'assistant_start') {
                return {
                    sessions: nextSessions,
                    items: [
                        ...state.items,
                        {
                            id: nextItemId(),
                            kind: 'assistant',
                            text: '',
                            thinking: '',
                            streaming: true,
                        },
                    ],
                };
            }

            if (event.kind === 'assistant_text_delta' || event.kind === 'assistant_thinking_delta') {
                const nextItems = [...state.items];
                let targetIndex = -1;
                for (let i = nextItems.length - 1; i >= 0; i -= 1) {
                    if (nextItems[i].kind === 'assistant') {
                        targetIndex = i;
                        break;
                    }
                }
                if (targetIndex === -1) {
                    nextItems.push({
                        id: nextItemId(),
                        kind: 'assistant',
                        text: event.kind === 'assistant_text_delta' ? event.delta : '',
                        thinking: event.kind === 'assistant_thinking_delta' ? event.delta : '',
                        streaming: true,
                    });
                    return { sessions: nextSessions, items: nextItems };
                }
                const target = nextItems[targetIndex];
                if (target.kind === 'assistant') {
                    nextItems[targetIndex] = {
                        ...target,
                        text: event.kind === 'assistant_text_delta' ? target.text + event.delta : target.text,
                        thinking: event.kind === 'assistant_thinking_delta' ? target.thinking + event.delta : target.thinking,
                    };
                }
                return { sessions: nextSessions, items: nextItems };
            }

            if (event.kind === 'assistant_end') {
                const nextItems = [...state.items];
                for (let i = nextItems.length - 1; i >= 0; i -= 1) {
                    const item = nextItems[i];
                    if (item.kind === 'assistant' && item.streaming) {
                        nextItems[i] = { ...item, streaming: false };
                        break;
                    }
                }
                return { sessions: nextSessions, items: nextItems };
            }

            if (event.kind === 'tool_start') {
                return {
                    sessions: nextSessions,
                    items: [
                        ...state.items,
                        {
                            id: nextItemId(),
                            kind: 'tool',
                            toolCallId: event.toolCallId,
                            toolName: event.toolName,
                            args: event.args,
                            output: '',
                            status: 'running',
                        },
                    ],
                };
            }

            if (event.kind === 'tool_update') {
                const nextItems = state.items.map((item) => {
                    if (item.kind === 'tool' && item.toolCallId === event.toolCallId) {
                        return { ...item, output: event.output };
                    }
                    return item;
                });
                return { sessions: nextSessions, items: nextItems };
            }

            if (event.kind === 'tool_end') {
                const nextItems = state.items.map((item) => {
                    if (item.kind === 'tool' && item.toolCallId === event.toolCallId) {
                        return {
                            ...item,
                            output: event.output || item.output,
                            status: event.isError ? ('error' as const) : ('success' as const),
                        };
                    }
                    return item;
                });
                return { sessions: nextSessions, items: nextItems };
            }

            if (event.kind === 'stderr') {
                const last = state.items[state.items.length - 1];
                if (last && last.kind === 'stderr') {
                    const nextItems = [...state.items];
                    nextItems[nextItems.length - 1] = {
                        ...last,
                        text: last.text + event.text,
                    };
                    return { sessions: nextSessions, items: nextItems };
                }
                return {
                    sessions: nextSessions,
                    items: [
                        ...state.items,
                        {
                            id: nextItemId(),
                            kind: 'stderr',
                            text: event.text,
                        },
                    ],
                };
            }

            return { sessions: nextSessions };
        });
    },
}));
