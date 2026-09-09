import React, { useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { create as createConfetti } from 'canvas-confetti';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import { ManualDownloadGuide } from '@/fronted/components/shared/ManualDownloadGuide';
import {
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileVideo,
    Folder,
    FolderOpen,
    HardDrive,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Check,
    Square,
    XCircle,
} from 'lucide-react';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { markOnboardingCompleted } from '@/fronted/features/onboarding/onboardingApi';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import { cn } from '@/fronted/lib/utils';
import toast from 'react-hot-toast';

export const CURRENT_ONBOARDING_VERSION = '1';

/** 离线资源包内三项资源的标识；数组顺序即下载顺序（先小后大）。 */
type BundleItemKey = 'tts' | 'transcription' | 'mt';

/** 点阵涟漪背景的列数与行数。 */
const RIPPLE_COLUMNS = 11;
const RIPPLE_ROWS = 5;
/** 点阵涟漪的呼吸周期（秒）：下载中更紧凑，让背景跟着进度"活"起来。 */
const RIPPLE_DURATION_IDLE = 3.6;
const RIPPLE_DURATION_ACTIVE = 1.4;
/** 网速的指数滑动平均系数，抑制进度事件抖动。 */
const SPEED_SMOOTHING = 0.3;

/** 下载完成后的收尾阶段文案；未收录的阶段回落到通用下载提示。 */
const PHASE_LABEL_KEYS: Partial<Record<ModelDownloadPhase, string>> = {
    verifying: 'steps.models.verifying',
    extracting: 'steps.models.extracting',
    installing: 'steps.models.installing',
};

/** 把字节/秒格式化为网速文案。 */
function formatSpeed(bytesPerSecond: number): string {
    const megabytes = bytesPerSecond / 1024 / 1024;
    return megabytes >= 1
        ? `${megabytes.toFixed(1)} MB/s`
        : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
}

/** 撒花颜色；固定亮色，保证深浅色主题下都醒目。 */
const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

/** 随机烟花连放的束数。 */
const FIREWORK_BURSTS = 4;

/**
 * 完成页的全屏庆祝动画。
 *
 * 用 canvas-confetti 在自建的全屏 canvas 上绘制，分三段递进：
 * 左右两侧斜向礼炮对射 → 中央星形爆发 → 随机位置的烟花连放，整段约 4 秒。
 * 动画跑在 Web Worker + OffscreenCanvas 上，不阻塞主线程；
 * 开启 `disableForReducedMotion`，偏好减少动效的用户直接跳过。
 */
const Confetti: React.FC = () => {
    React.useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        Object.assign(canvas.style, {
            position: 'fixed',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '50',
        });
        document.body.appendChild(canvas);

        const fire = createConfetti(canvas, { resize: true, useWorker: true, disableForReducedMotion: true });
        const base = { colors: CONFETTI_COLORS, disableForReducedMotion: true };

        // 两侧礼炮对射：扁平纸条 + 高初速，斜向上打到画面中部。
        void fire({ ...base, particleCount: 60, angle: 58, spread: 58, origin: { x: 0, y: 0.78 }, startVelocity: 60, scalar: 1.1, flat: true, ticks: 260 });
        void fire({ ...base, particleCount: 60, angle: 122, spread: 58, origin: { x: 1, y: 0.78 }, startVelocity: 60, scalar: 1.1, flat: true, ticks: 260 });

        // 中央星形爆发：星星与圆片混合，飘落更慢。
        void fire({ ...base, particleCount: 110, spread: 110, origin: { x: 0.5, y: 0.4 }, startVelocity: 44, scalar: 1.2, shapes: ['star', 'circle'], gravity: 0.9, decay: 0.91, ticks: 300 });

        // 随机位置烟花连放，把动画尾巴拉长到约 4 秒。
        const timers = Array.from({ length: FIREWORK_BURSTS }, (_, index) => window.setTimeout(() => {
            void fire({
                ...base,
                particleCount: 55,
                spread: 360,
                startVelocity: 26,
                origin: { x: 0.2 + Math.random() * 0.6, y: 0.22 + Math.random() * 0.34 },
                scalar: 0.9,
                shapes: ['star', 'circle'],
                gravity: 0.6,
                decay: 0.94,
                ticks: 200,
            });
        }, 240 + index * 240));

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            fire.reset();
            canvas.remove();
        };
    }, []);

    return null;
};

/**
 * 下载步骤背后的点阵涟漪。
 *
 * 小圆点按对角线错开延迟做透明度与缩放呼吸，只用 transform / opacity，不做大面积模糊；
 * 下载中周期变短。系统开启「减少动效」时由 CSS 直接停掉动画。
 */
const DotRippleBackground: React.FC<{ active: boolean }> = ({ active }) => {
    const dots = React.useMemo(
        () => Array.from({ length: RIPPLE_COLUMNS * RIPPLE_ROWS }, (_, index) => {
            const column = index % RIPPLE_COLUMNS;
            const row = Math.floor(index / RIPPLE_COLUMNS);
            return { key: index, delay: (column + row) * 0.16 };
        }),
        [],
    );

    return (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div
                className="grid h-full w-full items-center justify-items-center gap-3 px-2 py-6"
                style={{ gridTemplateColumns: `repeat(${RIPPLE_COLUMNS}, minmax(0, 1fr))` }}
            >
                {dots.map((dot) => (
                    <span
                        key={dot.key}
                        className="dot-ripple h-1 w-1 rounded-full bg-primary/60"
                        style={{
                            animationDelay: `${dot.delay}s`,
                            animationDuration: `${active ? RIPPLE_DURATION_ACTIVE : RIPPLE_DURATION_IDLE}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export interface OnboardingViewProps {
    onCompleted?: () => void;
}

/** 资源包内单项资源的展示信息与下载动作。 */
interface BundleEntry {
    key: BundleItemKey;
    /** 手动下载教程里展示的名字。 */
    title: string;
    ready: boolean;
    /** 有序候选下载地址（首个为主源，其余为备用镜像）。 */
    urls: readonly string[] | null;
    /** 手动下载后应保存到的路径。 */
    targetPath: string | null;
    /** 执行该项下载；失败时抛出。 */
    run: () => Promise<void>;
    /** 取消该项下载。 */
    cancel: () => Promise<void>;
}


export const OnboardingView: React.FC<OnboardingViewProps> = ({ onCompleted }) => {
    const { t } = useI18nTranslation('onboarding');

    const [currentStep, setCurrentStep] = useState<number>(1);
    /** 配置步骤共 2 步；第 3 步是完成页，不计入步骤。 */
    const totalSteps = 2;
    const [finishing, setFinishing] = useState(false);

    // Step 1：存储位置
    const [storagePath, setStoragePath] = useState('');
    const [storageAvailable, setStorageAvailable] = useState(true);
    const [choosingStorage, setChoosingStorage] = useState(false);

    // Step 2：资源包内三项资源的状态
    const [transcriptionEngine, setTranscriptionEngine] = useState<TranscriptionEngine>('whisper-cpp');
    const [ttsStatus, setTtsStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [transcriptionStatus, setTranscriptionStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [localMtStatus, setLocalMtStatus] = useState<LocalMtStatus | null>(null);

    // Step 2：下载过程
    const [downloadingBundle, setDownloadingBundle] = useState(false);
    const [activeItem, setActiveItem] = useState<BundleItemKey | null>(null);
    const [activePhase, setActivePhase] = useState<ModelDownloadPhase | null>(null);
    /** 当前是第几项（从 1 开始），用于"正在下载 2/3 项"。 */
    const [itemIndex, setItemIndex] = useState(0);
    const [progress, setProgress] = useState({ percent: 0, downloaded: 0, total: 0 });
    const [speed, setSpeed] = useState(0);
    const [bundleError, setBundleError] = useState<string | null>(null);
    /** 用户是否点了取消：用于中断串行队列，并区分"取消"与"失败"。 */
    const cancelRequestedRef = React.useRef(false);
    /** 最近一次进度采样，用于估算网速。 */
    const speedSampleRef = React.useRef<{ at: number; downloaded: number } | null>(null);

    /** 拉取存储位置与资源包内三项模型的状态。 */
    const refreshAllStatuses = React.useCallback(async () => {
        try {
            const engine = await settingsApi.getTranscriptionEngine().catch(() => 'whisper-cpp' as const);
            setTranscriptionEngine(engine);
            const [storageStatus, tts, transcription, localMt] = await Promise.all([
                settingsApi.getStorageStatus().catch(() => null),
                settingsApi.getSherpaTtsModelStatus().catch(() => null),
                (engine === 'whisper-cpp'
                    ? settingsApi.getWhisperCppModelStatus()
                    : settingsApi.getParakeetModelStatus()
                ).catch(() => null),
                settingsApi.getLocalMtStatus().catch(() => null),
            ]);
            if (storageStatus) {
                setStoragePath(storageStatus.resolvedPath);
                setStorageAvailable(storageStatus.available);
            }
            if (tts) setTtsStatus(tts);
            if (transcription) setTranscriptionStatus(transcription);
            if (localMt) setLocalMtStatus(localMt);
        } catch {
            // 状态拉取失败不阻断引导：页面保持"未下载"，用户仍可点下载或跳过
        }
    }, []);

    useEffect(() => {
        void refreshAllStatuses();
        // 用户可能在文件管理器里删掉或移动模型目录，窗口重新获得焦点时重新检测
        const refreshOnFocus = () => { void refreshAllStatuses(); };
        const refreshOnVisible = () => { if (!document.hidden) void refreshAllStatuses(); };
        window.addEventListener('focus', refreshOnFocus);
        document.addEventListener('visibilitychange', refreshOnVisible);
        return () => {
            window.removeEventListener('focus', refreshOnFocus);
            document.removeEventListener('visibilitychange', refreshOnVisible);
        };
    }, [refreshAllStatuses]);

    /** 记录一次进度采样：更新进度条，并用指数滑动平均估算网速。 */
    const trackProgress = React.useCallback((downloaded: number, total: number) => {
        setProgress({
            percent: total > 0 ? Math.min(100, Math.floor((downloaded / total) * 100)) : 0,
            downloaded,
            total,
        });
        const now = Date.now();
        const last = speedSampleRef.current;
        if (last && now > last.at && downloaded >= last.downloaded) {
            const instant = ((downloaded - last.downloaded) * 1000) / (now - last.at);
            setSpeed((previous) => (
                previous === 0 ? instant : previous * (1 - SPEED_SMOOTHING) + instant * SPEED_SMOOTHING
            ));
        }
        speedSampleRef.current = { at: now, downloaded };
    }, []);

    // 订阅主进程推送的下载进度（initRendererApis 会把 IPC 事件转成不带前缀的 window 事件）
    useEffect(() => {
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
            if (detail.phase === 'idle') void refreshAllStatuses();
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
            if (detail.phase === 'idle') void refreshAllStatuses();
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
    }, [refreshAllStatuses, trackProgress]);

    /** 复制文本到剪贴板。 */
    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('copied'));
        } catch {
            toast.error(t('copyFailed'));
        }
    };

    /** 在系统浏览器中打开下载地址。 */
    const openUrl = async (url: string) => {
        try {
            await settingsApi.openUrl(url);
        } catch {
            toast.error(t('openUrlFailed'));
        }
    };

    /** 打开模型文件所在文件夹。 */
    const openFolder = async (path: string) => {
        try {
            await settingsApi.openFolderForFile(path);
        } catch {
            toast.error(t('openFolderFailed'));
        }
    };

    /** 选择媒体库与模型存放目录，并立即生效。 */
    const handleChooseStorage = async () => {
        setChoosingStorage(true);
        try {
            const picked = await settingsApi.selectStorageFolder({ createDirectory: true });
            if (picked.length === 0) {
                return;
            }
            await settingsApi.saveStorage(picked[0]);
            await refreshAllStatuses();
            toast.success(t('steps.storage.saved'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setChoosingStorage(false);
        }
    };

    /** 资源包内的三项资源；顺序即下载顺序。 */
    const bundleEntries: BundleEntry[] = [
        {
            key: 'tts',
            title: t('steps.models.ttsTitle'),
            ready: ttsStatus?.ready ?? false,
            urls: ttsStatus?.downloadUrls ?? null,
            targetPath: ttsStatus?.archivePath ?? null,
            run: async () => { await settingsApi.downloadSherpaTtsModel(); },
            cancel: async () => { await settingsApi.cancelSherpaTtsModelDownload(); },
        },
        {
            key: 'transcription',
            title: t('steps.models.transcriptionTitle'),
            ready: transcriptionStatus?.ready ?? false,
            urls: transcriptionStatus?.downloadUrls ?? null,
            targetPath: transcriptionStatus?.archivePath ?? null,
            run: async () => {
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
        },
        {
            key: 'mt',
            title: t('steps.download.itemMt'),
            ready: localMtStatus?.ready ?? false,
            urls: localMtStatus?.downloadUrls ?? null,
            targetPath: localMtStatus?.modelPath ?? null,
            run: async () => { await settingsApi.downloadLocalMt(); },
            cancel: async () => { await settingsApi.cancelLocalMtDownload(); },
        },
    ];
    const pendingEntries = bundleEntries.filter((entry) => !entry.ready);
    const allReady = pendingEntries.length === 0;
    /** 手动下载教程里可复制/打开的落盘位置。 */
    const manualTargets = bundleEntries.flatMap((entry) => (
        entry.targetPath ? [{ key: entry.key, path: entry.targetPath }] : []
    ));
    /** 按当前网速估算的剩余时间文案；网速未知时为 null。 */
    const remainingLabel = (() => {
        if (speed <= 0 || progress.total <= progress.downloaded) return null;
        const seconds = (progress.total - progress.downloaded) / speed;
        return seconds >= 60
            ? t('steps.download.etaMinutes', {
                minutes: Math.floor(seconds / 60),
                seconds: Math.round(seconds % 60),
            })
            : t('steps.download.etaSeconds', { seconds: Math.max(1, Math.round(seconds)) });
    })();

    /**
     * 保存引导结果并进入完成页。
     *
     * 字幕翻译只在轻量模型确实就绪时才指向它，否则关闭：避免存下一个指向未下载模型的引擎。
     * 词典固定走内置词库（引擎关闭），超出词库的查询留到设置页再配。
     */
    const finishOnboarding = async () => {
        setFinishing(true);
        try {
            const [current, localMt] = await Promise.all([
                settingsApi.getEngineSelection(),
                settingsApi.getLocalMtStatus(),
            ]);
            await settingsApi.saveEngineSelection({
                ...current,
                providers: {
                    ...current.providers,
                    subtitleTranslationEngine: localMt.ready ? 'local-mt' : 'none',
                    dictionaryEngine: 'none',
                },
            });
            await markOnboardingCompleted(CURRENT_ONBOARDING_VERSION);
            setCurrentStep(totalSteps + 1);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setFinishing(false);
        }
    };

    /**
     * 依次下载资源包里尚未完成的项，全部成功后保存配置并进入完成页。
     *
     * 串行而非并发：同时下载会互相抢带宽，进度也难以理解。
     * 任一项失败即停下（原因展示在卡片里），已完成的部分保留。
     */
    const downloadBundle = async () => {
        cancelRequestedRef.current = false;
        setBundleError(null);
        setDownloadingBundle(true);
        try {
            for (let index = 0; index < pendingEntries.length; index++) {
                const entry = pendingEntries[index];
                setItemIndex(index + 1);
                setActiveItem(entry.key);
                setActivePhase(null);
                setProgress({ percent: 0, downloaded: 0, total: 0 });
                setSpeed(0);
                speedSampleRef.current = null;
                await entry.run();
                if (cancelRequestedRef.current) break;
            }
            if (!cancelRequestedRef.current) {
                await finishOnboarding();
            }
        } catch (error) {
            if (!cancelRequestedRef.current) {
                setBundleError(error instanceof Error ? error.message : String(error));
            }
        } finally {
            setActiveItem(null);
            setActivePhase(null);
            setDownloadingBundle(false);
        }
    };

    /** 取消当前项的下载并中断队列。 */
    const cancelBundleDownload = async () => {
        cancelRequestedRef.current = true;
        const entry = bundleEntries.find((item) => item.key === activeItem);
        if (!entry) return;
        try {
            await entry.cancel();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    const handleSkip = async () => {
        try {
            await markOnboardingCompleted(CURRENT_ONBOARDING_VERSION);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
        onCompleted?.();
    };

    return (
        <div className="flex h-screen w-full flex-col text-foreground bg-background select-none">
            {/* Top Bar */}
            <header className="top-0 flex h-9 items-center shrink-0">
                <TitleBar maximizable={false} className="top-0 left-0 w-full h-9 z-50" />
            </header>

            {/* Main Stage */}
            <main className="relative flex-1 flex flex-col items-center justify-between px-6 sm:px-12 py-8 max-w-3xl mx-auto w-full overflow-hidden">
                {currentStep > totalSteps && <Confetti />}

                {/* Header & Step Tracker */}
                <div className="w-full flex flex-col items-center text-center space-y-3 shrink-0">
                    {currentStep <= totalSteps && (
                        <div className="flex items-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                            <span>{t('stepIndicator', { current: currentStep, total: totalSteps })}</span>
                        </div>
                    )}

                    {currentStep <= totalSteps && (
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                                {t('dialogTitle')}
                            </h1>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                {t('dialogDescription')}
                            </p>
                        </div>
                    )}

                    {currentStep <= totalSteps && (
                        <div className="flex items-center gap-1.5 pt-1">
                            {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => (
                                <span
                                    key={step}
                                    className={cn(
                                        'h-1 rounded-full transition-all duration-300',
                                        step === currentStep
                                            ? 'w-8 bg-primary'
                                            : step < currentStep
                                                ? 'w-4 bg-primary/50'
                                                : 'w-4 bg-muted',
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-full my-auto py-6 max-w-2xl overflow-y-auto scrollbar-none">
                    {currentStep === 1 && (
                        <div className="space-y-4 animate-in fade-in-50 duration-200">
                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-base font-semibold flex items-center justify-center sm:justify-start gap-2">
                                    <HardDrive className="w-4 h-4 text-primary" />
                                    {t('steps.storage.title')}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t('steps.storage.desc')}
                                </p>
                            </div>

                            <div className="border rounded-xl p-4 bg-card shadow-xs space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                        <Folder className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-xs sm:text-sm">{t('steps.storage.pathLabel')}</div>
                                        <div className="text-xs text-muted-foreground font-mono break-all">
                                            {storagePath || t('steps.storage.pathLoading')}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 gap-1.5 text-xs shrink-0"
                                        disabled={choosingStorage}
                                        onClick={handleChooseStorage}
                                    >
                                        {choosingStorage ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <FolderOpen className="w-3.5 h-3.5" />
                                        )}
                                        {t('steps.storage.chooseFolder')}
                                    </Button>
                                </div>

                                {!storageAvailable && (
                                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{t('steps.storage.unavailable')}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {t('steps.storage.note')}
                            </p>
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="relative isolate space-y-4 animate-in fade-in-50 duration-200">
                            {/* isolate 让点阵的负 z-index 落在本步骤自己的层叠上下文里，否则会被页面背景盖住 */}
                            <DotRippleBackground active={downloadingBundle} />

                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-base font-semibold flex items-center justify-center sm:justify-start gap-2">
                                    <Download className="w-4 h-4 text-primary" />
                                    {t('steps.download.title')}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t('steps.download.desc')}
                                </p>
                            </div>

                            <div className="border rounded-xl p-4 bg-card shadow-xs space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                        <Download className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-xs sm:text-sm">{t('steps.download.packTitle')}</span>
                                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                {t('steps.download.packSize')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        {allReady ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                {t('steps.models.statusReady')}
                                            </span>
                                        ) : downloadingBundle ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 min-w-28 justify-center gap-1.5 text-xs"
                                                onClick={() => { void cancelBundleDownload(); }}
                                            >
                                                <Square className="w-3.5 h-3.5 text-destructive" />
                                                {t('steps.models.cancelDownload')}
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-8 min-w-28 justify-center gap-1.5 text-xs"
                                                onClick={() => { void downloadBundle(); }}
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                {bundleError ? t('steps.download.retry') : t('steps.models.actionDownload')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {downloadingBundle && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>
                                                {activePhase && PHASE_LABEL_KEYS[activePhase]
                                                    ? t(PHASE_LABEL_KEYS[activePhase] as string)
                                                    : t('steps.download.downloading', {
                                                        current: itemIndex,
                                                        total: pendingEntries.length,
                                                    })}
                                            </span>
                                            <span>{progress.percent}%</span>
                                        </div>
                                        <Progress value={progress.percent} className="h-1.5" />
                                        {speed > 0 && (
                                            <div className="text-[11px] text-muted-foreground">
                                                {formatSpeed(speed)}{remainingLabel ? ` · ${remainingLabel}` : ''}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {bundleError && (
                                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                        <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                        <span className="break-all">{bundleError}</span>
                                    </div>
                                )}
                            </div>

                            <ManualDownloadGuide variant="plain" title={t('steps.models.manualGuideTitle')}>
                                <div className="space-y-3">
                                    <div className="font-semibold text-foreground">{t('steps.models.manualStep1')}</div>
                                    {bundleEntries.map((entry) => (
                                        <div key={entry.key} className="space-y-1.5">
                                            <div className="font-semibold text-foreground">{entry.title}</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                                                {(entry.urls ?? []).map((url, index) => (
                                                    <div key={url} className="space-y-1">
                                                        <div className="flex items-start gap-1.5">
                                                            {index > 0 && (
                                                                <span className="shrink-0 mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    {t('steps.models.backupSource')}
                                                                </span>
                                                            )}
                                                            <span className="text-muted-foreground/70 break-all">{url}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 font-sans">
                                                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void copyText(url); }}>
                                                                <Copy className="w-3 h-3 mr-1" />
                                                                {t('steps.models.copyLink')}
                                                            </Button>
                                                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void openUrl(url); }}>
                                                                <ExternalLink className="w-3 h-3 mr-1" />
                                                                {t('steps.models.openInBrowser')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="space-y-1.5">
                                        <div className="font-semibold text-foreground">{t('steps.models.manualStep2')}</div>
                                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                                            {manualTargets.map((target) => (
                                                <div key={target.key} className="space-y-1.5">
                                                    <div className="text-muted-foreground/70">{target.path}</div>
                                                    <div className="flex items-center gap-2 font-sans">
                                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void copyText(target.path); }}>
                                                            <Copy className="w-3 h-3 mr-1" />
                                                            {t('steps.models.copyPath')}
                                                        </Button>
                                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { void openFolder(target.path); }}>
                                                            <FolderOpen className="w-3 h-3 mr-1" />
                                                            {t('steps.models.openFolder')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="font-semibold text-foreground">{t('steps.models.manualStep3')}</div>
                                        <div className="text-muted-foreground">{t('steps.models.installHint')}</div>
                                    </div>
                                </div>
                            </ManualDownloadGuide>

                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {t('steps.download.note')}
                            </p>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-5 animate-in fade-in-50 duration-200">
                            <div className="text-center space-y-2">
                                <div className="flex justify-center">
                                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                                        <Check className="h-6 w-6" />
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold">{t('steps.done.title')}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t('steps.done.desc')}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="text-center sm:text-left space-y-1">
                                    <h3 className="text-base font-semibold flex items-center justify-center sm:justify-start gap-2">
                                        <FileVideo className="w-4 h-4 text-primary" />
                                        {t('steps.tutorial.title')}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {t('steps.tutorial.desc')}
                                    </p>
                                </div>

                                <div className="space-y-3 pt-1">
                                    <div className="border rounded-xl p-4 bg-card shadow-xs space-y-2">
                                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                                            <Folder className="w-4 h-4 text-primary shrink-0" />
                                            <span>{t('steps.tutorial.method1Title')}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t('steps.tutorial.method1Desc')}
                                        </p>
                                        <div className="text-xs text-foreground/90 bg-muted/60 p-2.5 rounded-lg border border-border/40">
                                            {t('steps.tutorial.method1Tip')}
                                        </div>
                                    </div>

                                    <div className="border rounded-xl p-4 bg-card shadow-xs space-y-2">
                                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground">
                                            <FileVideo className="w-4 h-4 text-primary shrink-0" />
                                            <span>{t('steps.tutorial.method2Title')}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {t('steps.tutorial.method2Desc')}
                                        </p>
                                        <div className="text-xs text-foreground/90 bg-muted/60 p-2.5 rounded-lg border border-border/40">
                                            {t('steps.tutorial.method2Tip')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Footer Controls */}
                <div className="w-full max-w-2xl flex items-center justify-between pt-4 border-t border-border/60 shrink-0">
                    {currentStep <= totalSteps ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            disabled={finishing || downloadingBundle}
                            onClick={currentStep === totalSteps
                                ? () => { void finishOnboarding(); }
                                : () => { void handleSkip(); }}
                        >
                            {currentStep === totalSteps ? t('steps.download.skip') : t('skip')}
                        </Button>
                    ) : (
                        <span />
                    )}

                    <div className="flex items-center gap-2.5">
                        {currentStep > 1 && currentStep <= totalSteps && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8.5 px-3 text-xs gap-1.5 rounded-lg"
                                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                {t('prevStep')}
                            </Button>
                        )}

                        {currentStep < totalSteps && (
                            <Button
                                size="sm"
                                className="h-8.5 px-4 text-xs gap-1.5 rounded-lg"
                                onClick={() => setCurrentStep((s) => Math.min(totalSteps, s + 1))}
                            >
                                {t('nextStep')}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        )}

                        {currentStep === totalSteps && (
                            <Button
                                size="sm"
                                className="h-8.5 px-4 text-xs gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                disabled={finishing || downloadingBundle}
                                onClick={() => { void (allReady ? finishOnboarding() : downloadBundle()); }}
                            >
                                {finishing || downloadingBundle ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : allReady ? (
                                    <Check className="w-3.5 h-3.5" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                {downloadingBundle
                                    ? t('steps.download.downloadingShort')
                                    : allReady
                                        ? t('finishConfig')
                                        : t('steps.download.downloadAndFinish')}
                            </Button>
                        )}

                        {currentStep > totalSteps && (
                            <Button
                                size="sm"
                                className="h-8.5 px-4 text-xs gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={onCompleted}
                            >
                                {t('startUsing')}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OnboardingView;
