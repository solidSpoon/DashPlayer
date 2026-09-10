import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    ExternalLink,
    FolderOpen,
    Loader2,
    Square,
    Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/fronted/components/ui/alert-dialog';
import { ManualDownloadGuide } from '@/fronted/components/shared/ManualDownloadGuide';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/** 资源包内的资源标识。 */
type PackItemKey = 'tts' | 'transcription' | 'mt';

/** 进度与网速刷新到 UI 的最小间隔（毫秒）：进度事件很密，节流后数字才不会闪。 */
const PROGRESS_RENDER_INTERVAL_MS = 500;

/** 网速的指数滑动平均系数，抑制进度事件抖动。 */
const SPEED_SMOOTHING = 0.3;

/** 收尾阶段的文案键；下载中的文案统一用 `resources.pack.downloading`。 */
const PHASE_LABEL_KEYS: Partial<Record<ModelDownloadPhase, string>> = {
    verifying: 'resources.pack.verifying',
    extracting: 'resources.pack.extracting',
    installing: 'resources.pack.installing',
};

/** 把字节/秒格式化为网速文案。 */
const formatSpeed = (bytesPerSecond: number): string => {
    const megabytes = bytesPerSecond / (1024 * 1024);
    return megabytes >= 1
        ? `${Math.round(megabytes)} MB/s`
        : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
};

/** 资源包内单项资源的展示信息与动作。 */
interface PackItem {
    key: PackItemKey;
    title: string;
    description: string;
    ready: boolean;
    /** 手动下载教程里展示的模型文件名。 */
    modelLabel: string;
    /** 有序候选下载地址（首个为主源，其余为备用镜像）。 */
    urls: readonly string[];
    /** 手动下载后应保存到的路径。 */
    targetPath: string;
    download: () => Promise<void>;
    cancel: () => Promise<void>;
    remove: () => Promise<void>;
}

/**
 * 本地基础资源包卡片：发音、字幕识别、轻量翻译三合一。
 *
 * 默认只显示"就绪状态 + 一个下载按钮"，下载时是一条整体进度（按项数均分），
 * 识别方式、手动下载教程等技术细节收在「查看详情」里。
 */
export interface ResourcePackCardProps {
    /** 当前字幕识别方式。 */
    transcriptionEngine: TranscriptionEngine;
    /** 发音模型状态。 */
    ttsStatus: ModelInstallationStatusVO | null;
    /** 字幕识别模型状态。 */
    transcriptionStatus: ModelInstallationStatusVO | null;
    /** 轻量翻译模型状态。 */
    localMtStatus: LocalMtStatus | null;
    /** 下载/删除结束后刷新外层聚合状态。 */
    onRefresh: () => void;
    /** 切换字幕识别方式。 */
    onChangeEngine: (engine: TranscriptionEngine) => void;
}

export const ResourcePackCard: React.FC<ResourcePackCardProps> = ({
    transcriptionEngine,
    ttsStatus,
    transcriptionStatus,
    localMtStatus,
    onRefresh,
    onChangeEngine,
}) => {
    const { t } = useTranslation('settings');

    const [expanded, setExpanded] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [activePhase, setActivePhase] = React.useState<ModelDownloadPhase | null>(null);
    /** 正在下载的项；取消时用它决定中断哪一项。 */
    const [activeItemKey, setActiveItemKey] = React.useState<PackItemKey | null>(null);
    /** 整体进度按项数均分：已完成项数 + 当前项的完成比例。 */
    const [packProgress, setPackProgress] = React.useState({ completed: 0, count: 0 });
    /** 展示用的进度与网速；由 liveRef 按固定间隔刷新。 */
    const [live, setLive] = React.useState({ percent: 0, downloaded: 0, total: 0, speed: 0 });
    const liveRef = React.useRef({ percent: 0, downloaded: 0, total: 0, speed: 0 });
    const [error, setError] = React.useState<string | null>(null);
    /** 用户是否点了取消：用于中断串行队列，并区分"取消"与"失败"。 */
    const cancelRequestedRef = React.useRef(false);
    /** 最近一次进度采样，用于估算网速。 */
    const speedSampleRef = React.useRef<{ at: number; downloaded: number } | null>(null);

    /** 记录一次进度采样：写入原始快照，并用指数滑动平均估算网速。 */
    const trackProgress = React.useCallback((downloaded: number, total: number) => {
        const now = Date.now();
        const last = speedSampleRef.current;
        let speed = liveRef.current.speed;
        if (last && now > last.at && downloaded >= last.downloaded) {
            const instant = ((downloaded - last.downloaded) * 1000) / (now - last.at);
            speed = speed === 0 ? instant : speed * (1 - SPEED_SMOOTHING) + instant * SPEED_SMOOTHING;
        }
        speedSampleRef.current = { at: now, downloaded };
        liveRef.current = {
            percent: total > 0 ? Math.min(100, Math.floor((downloaded / total) * 100)) : 0,
            downloaded,
            total,
            speed,
        };
    }, []);

    // 按固定节奏把原始进度刷到界面上
    React.useEffect(() => {
        if (!downloading) return undefined;
        const timer = window.setInterval(() => {
            setLive({ ...liveRef.current });
        }, PROGRESS_RENDER_INTERVAL_MS);
        return () => window.clearInterval(timer);
    }, [downloading]);

    // 订阅主进程推送的下载进度（initRendererApis 会把 IPC 事件转成不带前缀的 window 事件）
    React.useEffect(() => {
        const handleArchiveProgress = (event: Event) => {
            const detail = (event as CustomEvent<{
                downloaded: number;
                total: number;
                phase: ModelDownloadPhase;
            }>).detail;
            setActivePhase(detail.phase);
            if (detail.phase === 'downloading' && detail.total > 0) {
                trackProgress(detail.downloaded, detail.total);
            }
            if (detail.phase === 'idle') onRefresh();
        };
        const handleLocalMtProgress = (event: Event) => {
            const detail = (event as CustomEvent<{
                downloaded: number;
                total: number;
                phase: LocalMtStatus['phase'];
            }>).detail;
            setActivePhase(detail.phase);
            if (detail.phase === 'downloading' && detail.total > 0) {
                trackProgress(detail.downloaded, detail.total);
            }
            if (detail.phase === 'idle') onRefresh();
        };

        window.addEventListener('sherpa-tts-model-download-progress', handleArchiveProgress);
        window.addEventListener('whisper-cpp-model-download-progress', handleArchiveProgress);
        window.addEventListener('parakeet-model-download-progress', handleArchiveProgress);
        window.addEventListener('local-mt-download-progress', handleLocalMtProgress);
        return () => {
            window.removeEventListener('sherpa-tts-model-download-progress', handleArchiveProgress);
            window.removeEventListener('whisper-cpp-model-download-progress', handleArchiveProgress);
            window.removeEventListener('parakeet-model-download-progress', handleArchiveProgress);
            window.removeEventListener('local-mt-download-progress', handleLocalMtProgress);
        };
    }, [onRefresh, trackProgress]);


    /** 复制文本到剪贴板。 */
    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('common.copied'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    /** 在系统浏览器中打开下载地址。 */
    const openUrl = async (url: string) => {
        try {
            await settingsApi.openUrl(url);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    /** 打开模型文件所在文件夹。 */
    const openFolder = async (path: string) => {
        try {
            await settingsApi.openFolderForFile(path);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        }
    };

    /** 资源包内的三项资源；顺序即下载顺序。 */
    const items: PackItem[] = [
        {
            key: 'tts',
            title: t('resources.pack.itemTts'),
            description: t('resources.pack.itemTtsDesc'),
            ready: ttsStatus?.ready ?? false,
            modelLabel: t('serviceCredentials.localTts.modelFile'),
            urls: ttsStatus?.downloadUrls ?? [],
            targetPath: ttsStatus?.archivePath ?? '',
            download: async () => { await settingsApi.downloadSherpaTtsModel(); },
            cancel: async () => { await settingsApi.cancelSherpaTtsModelDownload(); },
            remove: async () => { await settingsApi.deleteSherpaTtsModel(); },
        },
        {
            key: 'transcription',
            title: t('resources.pack.itemTranscription'),
            description: t('resources.pack.itemTranscriptionDesc'),
            ready: transcriptionStatus?.ready ?? false,
            modelLabel: transcriptionEngine === 'whisper-cpp'
                ? t('serviceCredentials.transcription.whisperCppModelFile')
                : t('serviceCredentials.transcription.sherpaOnnxModelFile'),
            urls: transcriptionStatus?.downloadUrls ?? [],
            targetPath: transcriptionStatus?.archivePath ?? '',
            download: async () => {
                if (transcriptionEngine === 'whisper-cpp') {
                    await settingsApi.downloadWhisperCppModel();
                } else {
                    await settingsApi.downloadParakeetModel();
                }
            },
            cancel: async () => {
                if (transcriptionEngine === 'whisper-cpp') {
                    await settingsApi.cancelWhisperCppModelDownload();
                } else {
                    await settingsApi.cancelParakeetModelDownload();
                }
            },
            remove: async () => {
                if (transcriptionEngine === 'whisper-cpp') {
                    await settingsApi.deleteWhisperCppModel();
                } else {
                    await settingsApi.deleteParakeetModel();
                }
            },
        },
        {
            key: 'mt',
            title: t('resources.pack.itemMt'),
            description: t('resources.pack.itemMtDesc'),
            ready: localMtStatus?.ready ?? false,
            modelLabel: t('resources.pack.mtFiles'),
            urls: localMtStatus?.downloadUrls ?? [],
            targetPath: localMtStatus?.modelPath ?? '',
            download: async () => { await settingsApi.downloadLocalMt(); },
            cancel: async () => { await settingsApi.cancelLocalMtDownload(); },
            remove: async () => { await settingsApi.deleteLocalMt(); },
        },
    ];
    const pendingItems = items.filter((item) => !item.ready);
    const allReady = pendingItems.length === 0;
    const readyCount = items.length - pendingItems.length;
    /** 整体进度百分比：已完成项按整项计入，当前项按其自身进度折算。 */
    const overallPercent = packProgress.count > 0
        ? Math.min(100, Math.floor(((packProgress.completed + live.percent / 100) / packProgress.count) * 100))
        : 0;
    /** 当前这一项的剩余时间文案；网速未知时为 null。 */
    const remainingLabel = (() => {
        if (live.speed <= 0 || live.total <= live.downloaded) return null;
        const seconds = (live.total - live.downloaded) / live.speed;
        // 低速下按秒数推算会得到毫无意义的大数，超过一小时只给个模糊说法
        if (seconds >= 3600) return t('resources.pack.etaLong');
        return seconds >= 60
            ? t('resources.pack.etaMinutes', {
                minutes: Math.floor(seconds / 60),
                seconds: Math.round(seconds % 60),
            })
            : t('resources.pack.etaSeconds', { seconds: Math.max(1, Math.round(seconds)) });
    })();
    /** 下载中的阶段文案：优先收尾阶段，其次统一的"正在下载所需资源"。 */
    const progressLabel = activePhase && PHASE_LABEL_KEYS[activePhase]
        ? t(PHASE_LABEL_KEYS[activePhase] as string)
        : t('resources.pack.downloading');

    /**
     * 依次下载资源包里尚未完成的项。
     *
     * 串行而非并发：同时下载会互相抢带宽，进度也难以理解。
     * 任一项失败即停下（原因展示在进度条下方），已完成的部分保留。
     */
    const downloadPack = async () => {
        cancelRequestedRef.current = false;
        setError(null);
        setDownloading(true);
        setPackProgress({ completed: 0, count: pendingItems.length });
        try {
            for (const item of pendingItems) {
                setActiveItemKey(item.key);
                setActivePhase(null);
                liveRef.current = { percent: 0, downloaded: 0, total: 0, speed: 0 };
                setLive({ percent: 0, downloaded: 0, total: 0, speed: 0 });
                speedSampleRef.current = null;
                await item.download();
                if (cancelRequestedRef.current) break;
                setPackProgress((previous) => ({ ...previous, completed: previous.completed + 1 }));
            }
            if (!cancelRequestedRef.current) {
                toast.success(t('resources.pack.downloaded'));
            }
        } catch (err) {
            if (!cancelRequestedRef.current) {
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setActiveItemKey(null);
            setActivePhase(null);
            setDownloading(false);
            onRefresh();
        }
    };

    /** 取消当前项的下载并中断队列。 */
    const cancelDownload = async () => {
        cancelRequestedRef.current = true;
        const current = items.find((item) => item.key === activeItemKey);
        if (!current) return;
        try {
            await current.cancel();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            onRefresh();
        }
    };

    /** 删除资源包内全部已下载的资源。 */
    const deletePack = async () => {
        setDeleting(true);
        try {
            for (const item of items) {
                if (item.ready) {
                    await item.remove();
                }
            }
            toast.success(t('resources.pack.deleted'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : String(err));
        } finally {
            setDeleting(false);
            onRefresh();
        }
    };

    return (
        <div className="p-4 space-y-4">
            {/* 状态行：一个徽标 + 一个主按钮（就绪后换成删除） */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    {allReady ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('resources.pack.ready')}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t('resources.pack.notReady')}
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                        {allReady
                            ? t('resources.pack.sizeHint')
                            : t('resources.pack.progressHint', {
                                size: t('resources.pack.sizeHint'),
                                done: readyCount,
                                total: items.length,
                            })}
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {allReady ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="outline" size="sm" disabled={deleting}>
                                    {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                                    {t('resources.pack.delete')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('resources.pack.deleteConfirmTitle')}</AlertDialogTitle>
                                    <AlertDialogDescription>{t('resources.pack.deleteConfirmDescription')}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('resources.pack.cancelDelete')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePack().catch(() => null)}>
                                        {t('resources.pack.confirmDelete')}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => (downloading ? cancelDownload() : downloadPack()).catch(() => null)}
                        >
                            {downloading ? (
                                <><Square className="mr-1.5 h-3.5 w-3.5" />{t('resources.pack.cancel')}</>
                            ) : (
                                <><Download className="mr-1.5 h-3.5 w-3.5" />{t('resources.pack.download')}</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {downloading && (
                <div className="space-y-2">
                    <Progress value={overallPercent} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progressLabel}</span>
                        <span>
                            {overallPercent}%
                            {live.speed > 0 ? ` · ${formatSpeed(live.speed)}` : ''}
                            {remainingLabel ? ` · ${remainingLabel}` : ''}
                        </span>
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    {t('resources.pack.failed', { message: error })}
                </div>
            )}

            {/* 技术细节：识别方式、单项状态、手动下载教程 */}
            <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {expanded ? t('resources.pack.hideDetails') : t('resources.pack.showDetails')}
            </button>

            {expanded && (
                <div className="space-y-4 border-t border-border/50 pt-3">
                    {items.map((item) => (
                        <div key={item.key} className="space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        {item.title}
                                        {item.ready ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {t('resources.pack.itemReady')}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                {t('resources.pack.itemMissing')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                </div>
                                {item.ready && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => openFolder(item.targetPath).catch(() => null)}
                                    >
                                        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                                        {t('common.openFolder')}
                                    </Button>
                                )}
                            </div>

                            {item.key === 'transcription' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('resources.pack.engineLabel')}</span>
                                    <Select
                                        value={transcriptionEngine}
                                        onValueChange={(value) => onChangeEngine(value as TranscriptionEngine)}
                                    >
                                        <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="whisper-cpp">{t('resources.pack.engineHardware')}</SelectItem>
                                            <SelectItem value="sherpa-onnx">{t('resources.pack.engineCompat')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {!item.ready && (
                                <ManualDownloadGuide variant="plain" title={t('resources.pack.manualTitle')}>
                                    {/* 第 1 步：要下什么 */}
                                    <div className="space-y-1.5">
                                        <div className="font-semibold text-foreground">{t('resources.pack.step1Title')}</div>
                                        <div className="text-muted-foreground/90">
                                            {t('resources.pack.manualModel', { model: item.modelLabel })}
                                        </div>
                                        {item.urls.length > 0 && (
                                            <div className="space-y-2 rounded border border-border/60 bg-background/80 p-2 font-mono text-[11px] select-text">
                                                {/* 首个为主源，其余为备用镜像；网络受限时可改用镜像地址手动下载 */}
                                                {item.urls.map((url, index) => (
                                                    <div key={url} className="space-y-1">
                                                        <div className="flex items-start gap-1.5">
                                                            {index > 0 && (
                                                                <span className="mt-0.5 shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    {t('resources.pack.backupSource')}
                                                                </span>
                                                            )}
                                                            <span className="break-all text-muted-foreground/70">{url}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 font-sans">
                                                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(url).catch(() => null)}>
                                                                <Copy className="mr-1 h-3 w-3" />
                                                                {t('resources.pack.copyUrl')}
                                                            </Button>
                                                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openUrl(url).catch(() => null)}>
                                                                <ExternalLink className="mr-1 h-3 w-3" />
                                                                {t('resources.pack.openInBrowser')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 第 2 步：放哪里 */}
                                    <div className="space-y-1.5">
                                        <div className="font-semibold text-foreground">{t('resources.pack.step2Title')}</div>
                                        <div className="space-y-2 rounded border border-border/60 bg-background/80 p-2.5 font-mono text-[11px] select-text">
                                            <div className="break-all text-muted-foreground/70">{item.targetPath}</div>
                                            <div className="flex items-center gap-2 pt-1 font-sans">
                                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(item.targetPath).catch(() => null)}>
                                                    <Copy className="mr-1 h-3 w-3" />
                                                    {t('resources.pack.copyPath')}
                                                </Button>
                                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openFolder(item.targetPath).catch(() => null)}>
                                                    <FolderOpen className="mr-1 h-3 w-3" />
                                                    {t('common.openFolder')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 第 3 步：装 */}
                                    <div className="space-y-0.5 rounded bg-muted/30 p-2 text-muted-foreground/90">
                                        <div className="font-semibold text-foreground">{t('resources.pack.step3Title')}</div>
                                        <div>{t('resources.pack.step3Hint')}</div>
                                    </div>
                                </ManualDownloadGuide>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ResourcePackCard;
