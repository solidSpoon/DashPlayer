import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import {
    AlertTriangle,
    ArrowUp,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Download,
    Film,
    FolderOpen,
    ListChecks,
    Loader2,
    Play,
    Plus,
    Settings,
    Square,
    Subtitles,
    Terminal,
    Trash2,
    XCircle,
} from 'lucide-react';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Progress } from '@/fronted/components/ui/progress';
import { downloadApi } from '@/fronted/features/download/downloadApi';
import { useDownloadStore, type DownloadTimelineItem } from '@/fronted/features/download/downloadStore';
import { FileAction } from '@/fronted/features/file-browser/components/FileSelector';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { requestVideoThumbnail } from '@/fronted/lib/video-thumbnail';
import UrlUtil from '@/common/utils/UrlUtil';
import { cn } from '@/fronted/lib/utils';
import type {
    PiDownloadChoiceCardInfo,
    PiDownloadContextVO,
    PiDownloadMediaCardInfo,
    PiDownloadPhase,
    PiDownloadProgressInfo,
    PiDownloadSendMessageRequest,
    PiDownloadStreamEvent,
} from '@/common/contracts/pi-download';
import type { PiRuntimeStatusVO } from '@/common/contracts/pi-runtime';

const PHASE_LABEL: Record<PiDownloadPhase, string> = {
    checking_env: '检测环境中',
    analyzing: '分析资源中',
    downloading: '下载中',
    postprocessing: '后处理中',
    completed: '已完成',
    error: '处理异常',
};

const QUICK_SUBTITLE_PROMPT =
    '请为已下载的视频补充下载人工英文字幕（仅下载原版人工英文字幕，不要下载自动生成字幕），转成同名 .srt 放到视频同目录。';

type RenderBlock =
    | { key: string; kind: 'item'; item: Exclude<DownloadTimelineItem, { kind: 'tool' }> }
    | { key: string; kind: 'tool_group'; tools: Array<Extract<DownloadTimelineItem, { kind: 'tool' }>> };

/**
 * 将原始时间线条目归并为渲染块：合并连续工具步骤、忽略空助理消息，
 * 并把下载中的临时占位卡片挂到相邻工具组下方，避免把工具步骤拆成两行。
 */
const buildRenderBlocks = (items: DownloadTimelineItem[]): RenderBlock[] => {
    const blocks: RenderBlock[] = [];
    let pendingDownloadingCard: Extract<DownloadTimelineItem, { kind: 'media_card' }> | null = null;

    const flushPendingDownloadingCard = () => {
        if (!pendingDownloadingCard) {
            return;
        }
        blocks.push({ key: pendingDownloadingCard.id, kind: 'item', item: pendingDownloadingCard });
        pendingDownloadingCard = null;
    };

    for (const item of items) {
        if (item.kind === 'tool') {
            const prev = blocks[blocks.length - 1];
            if (prev && prev.kind === 'tool_group') {
                prev.tools.push(item);
            } else {
                blocks.push({ key: `tg-${item.id}`, kind: 'tool_group', tools: [item] });
            }
            continue;
        }
        if (item.kind === 'assistant' && item.text.trim().length === 0) {
            continue;
        }
        if (item.kind === 'media_card' && item.card.state === 'downloading') {
            pendingDownloadingCard = item;
            continue;
        }
        flushPendingDownloadingCard();
        blocks.push({ key: item.id, kind: 'item', item });
    }

    flushPendingDownloadingCard();
    return blocks;
};

/**
 * 格式化会话时间显示：当天显示 HH:mm，跨天显示 MM/DD。
 */
const formatSessionTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
};

/**
 * 精简展示未命名会话的链接文本（去掉协议前缀）。
 */
const formatCompactUrl = (rawUrl: string): string =>
    rawUrl.replace(/^https?:\/\/(www\.)?/i, '');

/**
 * 内联思考 / 工具执行折叠条：将阶段文案与命令行细节融合，默认折叠保持对话流清爽。
 */
const StageActivityGroup: React.FC<{
    tools: Array<Extract<DownloadTimelineItem, { kind: 'tool' }>>;
    activeStageLabel?: string;
    isLastBlock: boolean;
    sessionRunning: boolean;
    sessionFailed: boolean;
}> = ({ tools, activeStageLabel, isLastBlock, sessionRunning, sessionFailed }) => {
    const [expanded, setExpanded] = useState(false);
    const hasRunning = tools.some((t) => t.status === 'running') || (isLastBlock && sessionRunning);
    // 只有当整个会话最终处于失败状态时才标红；中间步骤重试自愈不算异常
    const showError = !hasRunning && isLastBlock && sessionFailed;

    const summaryText = hasRunning
        ? (activeStageLabel ? `${activeStageLabel}...` : `正在执行（${tools.length} 步）...`)
        : showError
            ? `执行失败（${tools.length} 步）`
            : `已完成 ${tools.length} 个执行步骤`;

    return (
        <div className="py-0.5 text-xs">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
                {hasRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : showError ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                )}
                <span>{summaryText}</span>
                {expanded ? <ChevronDown className="h-3 w-3 opacity-70" /> : <ChevronRight className="h-3 w-3 opacity-70" />}
            </button>

            {expanded && (
                <div className="mt-1.5 ml-2 space-y-2 border-l border-border/70 pl-3">
                    {tools.map((tool) => {
                        const commandPreview = (() => {
                            if (tool.args && typeof tool.args === 'object' && 'command' in tool.args) {
                                return String((tool.args as { command?: unknown }).command ?? '');
                            }
                            return tool.args ? JSON.stringify(tool.args) : '';
                        })();
                        return (
                            <div key={tool.id} className="rounded-md border bg-muted/20 px-2.5 py-2">
                                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                                    <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground/85">
                                        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{commandPreview || tool.toolName}</span>
                                    </span>
                                    <span className="shrink-0">
                                        {tool.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                        {tool.status === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                        {tool.status === 'error' && <XCircle className="h-3 w-3 text-destructive" />}
                                    </span>
                                </div>
                                {tool.output && (
                                    <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                                        {tool.output}
                                    </pre>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/**
 * 对话流内嵌视频卡片：下载中显示骨架动画与实时进度；完成后显示缩略图与元数据，点击直接播放。
 */
const MediaDownloadCard: React.FC<{
    card: PiDownloadMediaCardInfo;
    onOpenVideo: (videoPath: string) => void;
}> = ({ card, onOpenVideo }) => {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    useEffect(() => {
        if (card.state !== 'ready' || !card.videoPath) {
            return;
        }
        let cancelled = false;
        requestVideoThumbnail({
            filePath: card.videoPath,
            time: 5,
            quality: 'medium',
            width: 480,
        })
            .then((url) => {
                if (!cancelled && url) {
                    setThumbnailUrl(url);
                }
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [card.state, card.videoPath]);

    if (card.state === 'downloading') {
        const hasPercent = typeof card.percent === 'number';
        return (
            <div className="flex items-center gap-4 rounded-xl border bg-card p-3 shadow-xs">
                {/* 下载中占位动画封面 */}
                <div className="relative flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />
                    <Film className="relative h-6 w-6 text-muted-foreground/60" />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                            {card.title}
                        </span>
                        {hasPercent && (
                            <span className="shrink-0 tabular-nums text-xs font-semibold text-primary">
                                {card.percent!.toFixed(1).replace(/\.0$/, '')}%
                            </span>
                        )}
                    </div>

                    {hasPercent ? (
                        <Progress value={card.percent!} className="h-1.5" />
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            <span>准备下载流...</span>
                        </div>
                    )}

                    {card.detail && (
                        <p className="truncate text-xs text-muted-foreground">{card.detail}</p>
                    )}
                </div>
            </div>
        );
    }

    const canPlay = Boolean(card.videoPath);

    return (
        <div
            role={canPlay ? 'button' : undefined}
            tabIndex={canPlay ? 0 : undefined}
            onClick={() => {
                if (card.videoPath) {
                    onOpenVideo(card.videoPath);
                }
            }}
            onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && card.videoPath) {
                    onOpenVideo(card.videoPath);
                }
            }}
            className={cn(
                'group flex items-center gap-4 rounded-xl border bg-card p-3 shadow-xs transition-colors',
                canPlay && 'cursor-pointer hover:border-primary/40 hover:bg-accent/30',
            )}
        >
            {/* 缩略图封面 */}
            <div className="relative flex h-20 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {thumbnailUrl ? (
                    <img
                        src={UrlUtil.toUrl(thumbnailUrl)}
                        alt={card.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                ) : (
                    <Film className="h-6 w-6 text-muted-foreground/60" />
                )}
                {canPlay && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow">
                            <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </div>
                    </div>
                )}
            </div>

            {/* 视频信息 */}
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="line-clamp-2 text-sm font-medium text-foreground">
                    {card.title}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {card.resolution && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
                            {card.resolution}
                        </span>
                    )}
                    {card.durationText && <span>{card.durationText}</span>}
                    {card.subtitlePath && (
                        <span className="inline-flex items-center gap-1">
                            <Subtitles className="h-3.5 w-3.5" />
                            含字幕
                        </span>
                    )}
                    {canPlay && (
                        <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            点击观看 →
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * 对话流内嵌交互提问卡片：支持单选与多选，提交后自动锁定并回传给下载 Agent。
 */
const ChoiceQuestionCard: React.FC<{
    card: PiDownloadChoiceCardInfo;
    disabled: boolean;
    onSubmit: (card: PiDownloadChoiceCardInfo, selectedValues: string[]) => Promise<void> | void;
}> = ({ card, disabled, onSubmit }) => {
    const [draftValues, setDraftValues] = useState<string[]>(() => card.selectedValues ?? []);
    const [submitting, setSubmitting] = useState(false);

    const isAnswered = Boolean(card.selectedValues && card.selectedValues.length > 0);
    const isReadOnly = isAnswered || disabled || submitting;
    const displayValues = isAnswered ? card.selectedValues! : draftValues;
    const isMultiple = card.selectionMode === 'multiple';

    const toggleValue = (value: string) => {
        if (isReadOnly) {
            return;
        }
        if (!isMultiple) {
            setDraftValues([value]);
            return;
        }
        setDraftValues((prev) => (
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        ));
    };

    const handleToggleAll = () => {
        if (isReadOnly || !isMultiple) {
            return;
        }
        if (draftValues.length === card.options.length) {
            setDraftValues([]);
        } else {
            setDraftValues(card.options.map((opt) => opt.value));
        }
    };

    const handleConfirm = async () => {
        if (isReadOnly || draftValues.length === 0) {
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(card, draftValues);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ListChecks className="h-4 w-4 shrink-0 text-primary" />
                        <span>{card.question}</span>
                    </div>
                    {card.description && (
                        <p className="text-xs text-muted-foreground">{card.description}</p>
                    )}
                </div>
                {isAnswered ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        已选择
                    </span>
                ) : (
                    isMultiple && !isReadOnly && card.options.length >= 3 && (
                        <button
                            type="button"
                            onClick={handleToggleAll}
                            className="shrink-0 text-xs text-primary hover:underline"
                        >
                            {draftValues.length === card.options.length ? '清空' : '全选'}
                        </button>
                    )
                )}
            </div>

            <div className="space-y-1.5">
                {card.options.map((option) => {
                    const checked = displayValues.includes(option.value);
                    return (
                        <button
                            key={option.value}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => toggleValue(option.value)}
                            className={cn(
                                'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                                checked
                                    ? 'border-primary/60 bg-primary/5 text-foreground'
                                    : 'border-border/70 bg-background/60 text-foreground/90',
                                !isReadOnly && !checked && 'hover:border-border hover:bg-muted/40',
                                isReadOnly && 'cursor-default opacity-90',
                            )}
                        >
                            <span
                                className={cn(
                                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
                                    isMultiple ? 'rounded' : 'rounded-full',
                                    checked
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-muted-foreground/40 bg-background',
                                )}
                            >
                                {checked && (
                                    isMultiple
                                        ? <Check className="h-3 w-3" />
                                        : <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium">{option.label}</span>
                                {option.description && (
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                        {option.description}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {!isReadOnly && (
                <div className="flex items-center justify-end pt-1">
                    <Button
                        type="button"
                        size="sm"
                        disabled={draftValues.length === 0 || submitting}
                        onClick={() => { void handleConfirm(); }}
                    >
                        {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {card.confirmLabel || '确认选择'}
                    </Button>
                </div>
            )}
        </div>
    );
};

/**
 * 从启动页跳转携带的路由参数。
 */
interface DownloadRouteState {
    /** 预填或自动触发下载的目标链接。 */
    initialUrl?: string;
    /** 环境就绪时是否自动发起下载。 */
    autoStart?: boolean;
}

/**
 * 媒体下载页：左历史列表 + 中间标准聊天对话流（含内嵌进度/结果视频卡片）。
 */
export default function DownloadPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRouteStateRef = useRef<DownloadRouteState | null>((location.state as DownloadRouteState | null) ?? null);
    const handledInitialUrlRef = useRef(false);
    const [urlInput, setUrlInput] = useState('');
    const [followUpInput, setFollowUpInput] = useState('');
    const [starting, setStarting] = useState(false);
    const [sendingFollowUp, setSendingFollowUp] = useState(false);
    const [runtimeStatus, setRuntimeStatus] = useState<PiRuntimeStatusVO | null>(null);
    const [downloadContext, setDownloadContext] = useState<PiDownloadContextVO | null>(null);
    const [defaultVideosDir, setDefaultVideosDir] = useState<string>('');
    const [customOutputDir, setCustomOutputDir] = useState<string | null>(null);
    const [expandedInitialPrompt, setExpandedInitialPrompt] = useState(false);

    const sessions = useDownloadStore((state) => state.sessions);
    const session = useDownloadStore((state) => state.session);
    const items = useDownloadStore((state) => state.items);
    const progress = useDownloadStore((state) => state.progress);
    const error = useDownloadStore((state) => state.error);
    const setSessions = useDownloadStore((state) => state.setSessions);
    const loadSessionDetail = useDownloadStore((state) => state.loadSessionDetail);
    const applyStreamEvent = useDownloadStore((state) => state.applyStreamEvent);
    const removeSessionFromList = useDownloadStore((state) => state.removeSessionFromList);
    const reset = useDownloadStore((state) => state.reset);

    const bottomRef = useRef<HTMLDivElement | null>(null);

    const selectSession = useCallback(async (sessionId: string) => {
        try {
            const detail = await downloadApi.getSession(sessionId);
            if (detail) {
                loadSessionDetail(detail);
                setExpandedInitialPrompt(false);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    }, [loadSessionDetail]);

    useEffect(() => {
        let cancelled = false;
        const routeState = initialRouteStateRef.current;
        const pendingUrl = routeState?.initialUrl?.trim() ?? '';
        const hasPendingUrl = pendingUrl.length > 0 && !handledInitialUrlRef.current;
        if (hasPendingUrl) {
            reset();
        }

        void (async () => {
            const [runtime, ctx, list] = await Promise.all([
                settingsApi.getPiRuntimeStatus().catch(() => null),
                downloadApi.getContext().catch(() => null),
                downloadApi.listSessions().catch(() => null),
            ]);
            if (cancelled) {
                return;
            }
            if (runtime) {
                setRuntimeStatus(runtime);
            }
            if (ctx) {
                setDownloadContext(ctx);
                setDefaultVideosDir(ctx.videosDir);
            }
            if (list) {
                setSessions(list);
                if (!hasPendingUrl) {
                    const activeItem = list.find((item) => item.status === 'running' || item.status === 'starting');
                    if (!useDownloadStore.getState().session && activeItem) {
                        void selectSession(activeItem.sessionId);
                    }
                }
            }

            if (hasPendingUrl && !handledInitialUrlRef.current) {
                handledInitialUrlRef.current = true;
                navigate(location.pathname, { replace: true, state: null });
                if (routeState?.autoStart && runtime?.installed && ctx?.aiReady) {
                    setStarting(true);
                    try {
                        const detail = await downloadApi.start(pendingUrl);
                        if (!cancelled) {
                            loadSessionDetail(detail);
                            setExpandedInitialPrompt(false);
                        }
                    } catch (err) {
                        if (!cancelled) {
                            toast.error(err instanceof Error ? err.message : String(err));
                            setUrlInput(pendingUrl);
                        }
                    } finally {
                        if (!cancelled) {
                            setStarting(false);
                        }
                    }
                } else {
                    setUrlInput(pendingUrl);
                }
            }
        })();

        const handlePiEvent = (event: Event) => {
            const customEvent = event as CustomEvent<PiDownloadStreamEvent>;
            applyStreamEvent(customEvent.detail);
        };
        window.addEventListener('pi-download-event', handlePiEvent);
        return () => {
            cancelled = true;
            window.removeEventListener('pi-download-event', handlePiEvent);
        };
    }, [applyStreamEvent, loadSessionDetail, location.pathname, navigate, reset, selectSession, setSessions]);

    const lastItem = items[items.length - 1];
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [items.length, lastItem]);

    const handleStartDownload = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const trimmed = urlInput.trim();
        if (!trimmed) {
            toast.error('请先输入下载链接');
            return;
        }
        setStarting(true);
        try {
            const detail = await downloadApi.start(trimmed, customOutputDir ?? undefined);
            loadSessionDetail(detail);
            setUrlInput('');
            setExpandedInitialPrompt(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setStarting(false);
        }
    };

    const handlePickOutputDir = async () => {
        try {
            const folders = await downloadApi.selectFolder();
            const picked = folders?.[0];
            if (picked) {
                setCustomOutputDir(picked);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    /**
     * 向当前会话发送补充指令，供底部输入框提交、快捷指令与交互卡片复用。
     *
     * @param rawText 待发送的原始指令文本。
     * @param choiceReply 若来自交互选择卡片，附带卡片 ID 与已选值。
     * @returns 是否成功发送。
     */
    const sendFollowUpMessage = async (
        rawText: string,
        choiceReply?: PiDownloadSendMessageRequest['choiceReply'],
    ): Promise<boolean> => {
        if (!session || sendingFollowUp) {
            return false;
        }
        const trimmed = rawText.trim();
        if (!trimmed) {
            return false;
        }
        setSendingFollowUp(true);
        try {
            await downloadApi.sendMessage(session.sessionId, trimmed, choiceReply);
            return true;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
            return false;
        } finally {
            setSendingFollowUp(false);
        }
    };

    /**
     * 提交交互提问卡片的选中结果，锁定卡片状态并回传给 Agent。
     */
    const handleSubmitChoiceCard = async (
        card: PiDownloadChoiceCardInfo,
        selectedValues: string[],
    ): Promise<void> => {
        const selectedLabels = selectedValues.map((val) => {
            const matched = card.options.find((opt) => opt.value === val);
            return matched ? `${matched.label} (${matched.value})` : val;
        });
        const replyText = `针对「${card.question}」的选择：${selectedLabels.join('、')}`;
        await sendFollowUpMessage(replyText, {
            choiceId: card.choiceId,
            selectedValues,
        });
    };

    /**
     * 提交底部输入框的后续指令，发送成功后清空输入内容。
     */
    const handleSendFollowUp = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const sent = await sendFollowUpMessage(followUpInput);
        if (sent) {
            setFollowUpInput('');
        }
    };

    const handleAbort = async () => {
        if (!session) {
            return;
        }
        try {
            await downloadApi.abort(session.sessionId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    const handleDeleteSession = async (event: React.MouseEvent, sessionId: string) => {
        event.stopPropagation();
        try {
            await downloadApi.deleteSession(sessionId);
            removeSessionFromList(sessionId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    const handleOpenVideo = useCallback((videoPath: string) => {
        void FileAction.playerAction2(navigate)([videoPath]).catch((err) => {
            toast.error(err instanceof Error ? err.message : String(err));
        });
    }, [navigate]);

    const isRunning = session?.status === 'running' || session?.status === 'starting';
    const hasReadyVideoWithoutSubtitle = items.some(
        (item) => item.kind === 'media_card' && item.card.state === 'ready' && !item.card.subtitlePath,
    );
    const activeStageLabel = (progress: PiDownloadProgressInfo | null): string | undefined => {
        if (!progress) {
            return undefined;
        }
        return progress.detail || PHASE_LABEL[progress.phase];
    };
    const renderBlocks = buildRenderBlocks(items);
    const lastBlock = renderBlocks[renderBlocks.length - 1];
    const showBottomRunningIndicator =
        isRunning
        && renderBlocks.length > 0
        && lastBlock?.kind !== 'tool_group'
        && !(lastBlock?.kind === 'item' && lastBlock.item.kind === 'media_card' && lastBlock.item.card.state === 'downloading');

    return (
        <div className="flex h-full w-full flex-col overflow-hidden select-none bg-background text-foreground">
            {/* 与应用内其他页面保持一致的标题栏，不占用右上角窗口控制区 */}
            <div className="shrink-0 border-b px-6 pt-5 pb-3">
                <PageHeader
                    title="视频下载"
                    description="粘贴链接，自动获取 1080p 视频"
                />
            </div>

            {/* 主体两栏：左侧历史记录 + 中间（新建下载屏 / 标准聊天对话流） */}
            <div className="flex min-h-0 flex-1">
                {/* 左侧历史会话列表 */}
                <aside className="flex w-64 shrink-0 flex-col border-r border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                            下载记录
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => reset()}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            新建
                        </Button>
                    </div>

                    <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
                        {sessions.length === 0 ? (
                            <div className="px-2 py-10 text-center text-xs text-muted-foreground/70">
                                暂无下载记录
                            </div>
                        ) : (
                            sessions.map((item) => {
                                const isSelected = session?.sessionId === item.sessionId;
                                const itemRunning = item.status === 'running' || item.status === 'starting';
                                const displayTitle = item.title || formatCompactUrl(item.url);
                                return (
                                    <div
                                        key={item.sessionId}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => { void selectSession(item.sessionId); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                void selectSession(item.sessionId);
                                            }
                                        }}
                                        className={cn(
                                            'group relative flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors',
                                            isSelected
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                {itemRunning && (
                                                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                                                )}
                                                {item.status === 'error' && (
                                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                                                )}
                                                <span className="truncate text-[13px] font-medium text-foreground">
                                                    {displayTitle}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <span className="text-[11px] tabular-nums text-muted-foreground/70 group-hover:hidden">
                                                {formatSessionTime(item.createdAt)}
                                            </span>
                                            <button
                                                type="button"
                                                title="删除记录"
                                                onClick={(e) => { void handleDeleteSession(e, item.sessionId); }}
                                                className="hidden rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive group-hover:block"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* 中间主区域：新建下载屏幕 或 标准聊天流 */}
                {!session ? (
                    <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-10 py-10">
                        <div className="w-full max-w-2xl space-y-6">
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                    输入链接开始下载
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    默认优先下载 1080p 兼容视频，完成后可按需补充下载字幕
                                </p>
                            </div>

                            {runtimeStatus && !runtimeStatus.installed && (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>Agent 运行环境尚未安装，请先前往设置页下载</span>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 shrink-0 text-xs"
                                        onClick={() => navigate('/settings/resources')}
                                    >
                                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                                        去设置
                                    </Button>
                                </div>
                            )}

                            {downloadContext && !downloadContext.aiReady && downloadContext.aiIssue && (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>{downloadContext.aiIssue}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 shrink-0 text-xs"
                                        onClick={() => navigate('/settings/resources')}
                                    >
                                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                                        去设置
                                    </Button>
                                </div>
                            )}

                            <form onSubmit={handleStartDownload} className="flex items-center gap-3">
                                <Input
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="粘贴视频或媒体链接..."
                                    className="h-11 flex-1 text-sm select-text"
                                    disabled={starting}
                                />
                                <Button type="submit" disabled={starting || !urlInput.trim()} className="h-11 px-6">
                                    {starting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                    )}
                                    开始下载
                                </Button>
                            </form>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                                <div className="flex min-w-0 items-center gap-2">
                                    <FolderOpen className="h-4 w-4 shrink-0" />
                                    <span className="shrink-0">本次保存目录：</span>
                                    <span className="truncate font-mono text-foreground/85 select-text" title={customOutputDir ?? defaultVideosDir}>
                                        {customOutputDir ?? (defaultVideosDir || '读取中...')}
                                    </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    {customOutputDir && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => setCustomOutputDir(null)}
                                        >
                                            恢复默认
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2.5 text-xs"
                                        onClick={() => { void handlePickOutputDir(); }}
                                    >
                                        选择目录
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </main>
                ) : (
                    <main className="flex min-w-0 flex-1 flex-col">
                        <div className="flex-1 overflow-y-auto px-6 py-5 select-text">
                            <div className="mx-auto max-w-3xl space-y-4">
                                {(() => {
                                    const stageText = activeStageLabel(progress);

                                    return renderBlocks.map((block, index) => {
                                        const isLastBlock = index === renderBlocks.length - 1;
                                        if (block.kind === 'tool_group') {
                                            return (
                                                <StageActivityGroup
                                                    key={block.key}
                                                    tools={block.tools}
                                                    activeStageLabel={stageText}
                                                    isLastBlock={isLastBlock}
                                                    sessionRunning={isRunning}
                                                    sessionFailed={session.status === 'error'}
                                                />
                                            );
                                        }
                                        const item = block.item;
                                        if (item.kind === 'system' || (item.kind === 'user' && item.isInitialPrompt)) {
                                            return (
                                                <div key={item.id} className="text-xs text-muted-foreground">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedInitialPrompt((prev) => !prev)}
                                                        className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted/50 hover:text-foreground"
                                                    >
                                                        {expandedInitialPrompt ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                        <span>系统提示词</span>
                                                    </button>
                                                    {expandedInitialPrompt && (
                                                        <pre className="mt-1.5 rounded-lg border bg-muted/20 p-3 whitespace-pre-wrap break-words font-sans text-xs text-foreground/80">
                                                            {item.text}
                                                        </pre>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (item.kind === 'user') {
                                            return (
                                                <div key={item.id} className="flex justify-end">
                                                    <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
                                                        {item.text}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (item.kind === 'media_card') {
                                            return (
                                                <MediaDownloadCard
                                                    key={item.id}
                                                    card={item.card}
                                                    onOpenVideo={handleOpenVideo}
                                                />
                                            );
                                        }

                                        if (item.kind === 'choice_card') {
                                            return (
                                                <ChoiceQuestionCard
                                                    key={item.id}
                                                    card={item.card}
                                                    disabled={isRunning || session.status === 'closed' || sendingFollowUp}
                                                    onSubmit={handleSubmitChoiceCard}
                                                />
                                            );
                                        }

                                        if (item.kind === 'assistant') {
                                            return (
                                                <div key={item.id} className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-foreground">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {item.text}
                                                    </ReactMarkdown>
                                                </div>
                                            );
                                        }

                                        return (
                                            <pre key={item.id} className="max-h-40 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 font-mono text-[11px] text-amber-700 dark:text-amber-300">
                                                {item.text}
                                            </pre>
                                        );
                                    });
                                })()}

                                {showBottomRunningIndicator && (
                                    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                        <span>{activeStageLabel(progress) ?? '正在处理...'}</span>
                                    </div>
                                )}

                                {error && (
                                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}

                                <div ref={bottomRef} />
                            </div>
                        </div>

                        {/* 底部悬浮圆角输入区 / 历史会话只读提示 */}
                        {session.status === 'closed' ? (
                            <div className="shrink-0 px-6 pt-2 pb-5">
                                <div className="mx-auto max-w-3xl rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-center text-xs text-muted-foreground">
                                    历史会话仅供查看，如需继续下载或补充字幕请点击左侧「新建」
                                </div>
                            </div>
                        ) : (
                            <div className="shrink-0 px-6 pt-2 pb-5">
                                <div className="mx-auto max-w-3xl space-y-2">
                                    {!isRunning && hasReadyVideoWithoutSubtitle && (
                                        <div className="flex flex-wrap items-center gap-2 px-1">
                                            <button
                                                type="button"
                                                disabled={sendingFollowUp}
                                                onClick={() => { void sendFollowUpMessage(QUICK_SUBTITLE_PROMPT); }}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs text-muted-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
                                            >
                                                <Subtitles className="h-3.5 w-3.5" />
                                                <span>下载人工英文字幕</span>
                                            </button>
                                        </div>
                                    )}
                                    <form
                                        onSubmit={handleSendFollowUp}
                                        className="flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-3.5 py-2 shadow-sm transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15"
                                    >
                                        <input
                                            type="text"
                                            value={followUpInput}
                                            onChange={(e) => setFollowUpInput(e.target.value)}
                                            placeholder={isRunning ? '执行中，可输入补充指令进行调整...' : '输入后续指令（例如：使用 Chrome Cookie 重试、只下载 1080p）...'}
                                            className="h-8 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none select-text"
                                        />
                                        {isRunning ? (
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="secondary"
                                                title="停止"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                onClick={handleAbort}
                                            >
                                                <Square className="h-3.5 w-3.5 fill-current" />
                                            </Button>
                                        ) : (
                                            <Button
                                                type="submit"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                disabled={sendingFollowUp || !followUpInput.trim()}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </form>
                                </div>
                            </div>
                        )}
                    </main>
                )}
            </div>
        </div>
    );
}
