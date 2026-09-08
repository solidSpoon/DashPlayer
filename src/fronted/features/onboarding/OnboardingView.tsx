import React, { useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/fronted/components/ui/radio-group';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Label } from '@/fronted/components/ui/label';
import { Input } from '@/fronted/components/ui/input';
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
    Languages,
    Loader2,
    Mic,
    Volume2,
    Cloud,
    Cpu,
    ArrowRight,
    ArrowLeft,
    Check,
    Square,
    TestTube,
    XCircle,
} from 'lucide-react';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { getSystemInfo, markOnboardingCompleted } from '@/fronted/features/onboarding/onboardingApi';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { LocalAiStatus } from '@/common/contracts/local-ai';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import type { SystemInfo } from '@/fronted/features/onboarding/onboardingApi';
import { LOCAL_AI_DEFAULT_MODEL_ID } from '@/common/contracts/local-ai';
import { cn } from '@/fronted/lib/utils';
import toast from 'react-hot-toast';

export const CURRENT_ONBOARDING_VERSION = '1';

/** 翻译与查词的档位：一次决定字幕翻译与查词各自使用的引擎。 */
type TranslationTier = 'light' | 'smart' | 'cloud';

/** 档位展示顺序。 */
const TRANSLATION_TIERS: readonly TranslationTier[] = ['light', 'smart', 'cloud'];

/**
 * 档位到引擎组合的映射：查词永远跟随字幕翻译。
 *
 * 这样就不会出现「下了 1.28 GB 智能模型却只用它查词」这类无意义组合。
 */
const TIER_ENGINES: Record<TranslationTier, {
    subtitleTranslationEngine: 'local-mt' | 'local' | 'openai';
    dictionaryEngine: 'none' | 'local' | 'openai';
}> = {
    light: { subtitleTranslationEngine: 'local-mt', dictionaryEngine: 'none' },
    smart: { subtitleTranslationEngine: 'local', dictionaryEngine: 'local' },
    cloud: { subtitleTranslationEngine: 'openai', dictionaryEngine: 'openai' },
};

/** GPU 后端在提示文案里的显示名（专有名词，不翻译）。 */
const GPU_ACCELERATION_LABELS: Record<'metal' | 'vulkan', string> = {
    metal: 'Metal',
    vulkan: 'Vulkan',
};

/** 内存低于该值（GB）时推荐轻量档。 */
const LIGHT_TIER_MEMORY_GB = 8;
/** 没有 GPU 加速时，核数低于该值也推荐轻量档。 */
const LIGHT_TIER_CPU_COUNT = 4;

/**
 * 依据硬件信息推荐档位：内存不足，或没有 GPU 加速且核数偏少时推荐轻量档。
 *
 * @param hardware 本机硬件信息。
 * @returns 推荐档位；也用作引导页的默认选中档。
 */
function recommendTier(hardware: SystemInfo): TranslationTier {
    if (hardware.totalMemoryGb < LIGHT_TIER_MEMORY_GB) return 'light';
    if (hardware.gpuAcceleration === 'none' && hardware.cpuCount < LIGHT_TIER_CPU_COUNT) return 'light';
    return 'smart';
}

/** 撒花颜色；固定亮色，保证深浅色主题下都醒目。 */
const CONFETTI_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

/**
 * 完成页的全屏撒花。
 *
 * 固定定位铺满窗口（不受内容容器裁剪），每片纸屑有随机的横向漂移与旋转；
 * 纯 CSS 动画实现（keyframes 见 index.css 的 confetti-fall），不引入额外依赖。
 */
const Confetti: React.FC = () => {
    const pieces = React.useMemo(
        () => Array.from({ length: 120 }, (_, index) => ({
            left: Math.random() * 100,
            delay: Math.random() * 2.4,
            duration: 2.6 + Math.random() * 2.4,
            size: 6 + Math.random() * 8,
            drift: (Math.random() - 0.5) * 260,
            spin: 360 + Math.random() * 900,
            round: index % 3 === 0,
            color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        })),
        [],
    );

    return (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
            {pieces.map((piece, index) => (
                <span
                    key={index}
                    className="absolute top-0 block"
                    style={{
                        left: `${piece.left}%`,
                        width: `${piece.size}px`,
                        height: `${piece.round ? piece.size : piece.size * 1.7}px`,
                        borderRadius: piece.round ? '9999px' : '2px',
                        backgroundColor: piece.color,
                        animation: `confetti-fall ${piece.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) ${piece.delay}s forwards`,
                        '--confetti-drift': `${piece.drift}px`,
                        '--confetti-spin': `${piece.spin}deg`,
                    } as React.CSSProperties}
                />
            ))}
        </div>
    );
};

export interface OnboardingViewProps {
    onCompleted?: () => void;
}

interface ModelDownloadRowProps {
    icon: React.ElementType;
    title: string;
    description: string;
    /** 体积标签，与描述分开展示，如“约 300 MB”。 */
    sizeLabel?: string;
    ready: boolean;
    downloading: boolean;
    progress: number;
    /** 有序候选下载地址（首个为官方地址，其余为备用镜像）；存在时展示手动下载教程。 */
    downloadUrls?: readonly string[] | null;
    /** 手动下载后应保存到的文件/目录路径。 */
    targetPath?: string | null;
    onDownload: () => void;
    onCancel: () => void;
    onCopy: (text: string) => void;
    onOpenUrl: (url: string) => void;
    onOpenFolder: (path: string) => void;
}

/**
 * 引导页里的单个离线模型行：状态、下载/取消、进度条，以及网络不佳时的手动下载教程。
 */
const ModelDownloadRow: React.FC<ModelDownloadRowProps> = ({
    icon: Icon,
    title,
    description,
    sizeLabel,
    ready,
    downloading,
    progress,
    downloadUrls,
    targetPath,
    onDownload,
    onCancel,
    onCopy,
    onOpenUrl,
    onOpenFolder,
}) => {
    const { t } = useI18nTranslation('onboarding');

    return (
        <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                        <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs sm:text-sm">{title}</span>
                            {sizeLabel && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {sizeLabel}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                </div>

                <div className="shrink-0">
                    {ready ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {t('steps.models.statusReady')}
                        </span>
                    ) : downloading ? (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 min-w-28 justify-center gap-1.5 text-xs"
                            onClick={onCancel}
                        >
                            <Square className="w-3.5 h-3.5 text-destructive" />
                            {t('steps.models.cancelDownload')}
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 min-w-28 justify-center gap-1.5 text-xs"
                            onClick={onDownload}
                        >
                            <Download className="w-3.5 h-3.5" />
                            {t('steps.models.actionDownload')}
                        </Button>
                    )}
                </div>
            </div>

            {downloading && (
                <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{t('steps.models.downloading')}</span>
                        <span>{Math.min(100, Math.max(0, Math.round(progress)))}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                </div>
            )}

            {!ready && downloadUrls && downloadUrls.length > 0 && (
                <ManualDownloadGuide variant="plain" title={t('steps.models.manualGuideTitle')}>
                    <div className="space-y-1.5">
                        <div className="font-semibold text-foreground">{t('steps.models.manualStep1')}</div>
                        <div className="bg-background/80 rounded border border-border/60 p-2 space-y-2 font-mono text-[11px] break-all select-text">
                            {/* 首个为官方地址，其余为备用镜像；网络受限时可改用镜像地址手动下载 */}
                            {downloadUrls.map((url, index) => (
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
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(url)}>
                                            <Copy className="w-3 h-3 mr-1" />
                                            {t('steps.models.copyLink')}
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenUrl(url)}>
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            {t('steps.models.openInBrowser')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {targetPath && (
                        <div className="space-y-1.5">
                            <div className="font-semibold text-foreground">{t('steps.models.manualStep2')}</div>
                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                <div className="text-muted-foreground/70">{targetPath}</div>
                                <div className="flex items-center gap-2 pt-1 font-sans">
                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onCopy(targetPath)}>
                                        <Copy className="w-3 h-3 mr-1" />
                                        {t('steps.models.copyPath')}
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenFolder(targetPath)}>
                                        <FolderOpen className="w-3 h-3 mr-1" />
                                        {t('steps.models.openFolder')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                        <div className="font-semibold text-foreground">{t('steps.models.manualStep3')}</div>
                        <div>{t('steps.models.manualStep3Hint')}</div>
                    </div>
                </ManualDownloadGuide>
            )}
        </div>
    );
};

/**
 * 首次使用引导：离线模型下载、翻译与词典配置、基础教程。
 *
 * 引导页不暴露引擎名与模型名，用户只看到"用途 + 下载/配置"。
 */
export const OnboardingView: React.FC<OnboardingViewProps> = ({
    onCompleted,
}) => {
    const { t } = useI18nTranslation('onboarding');

    const [currentStep, setCurrentStep] = useState<number>(1);
    /** 配置步骤共 3 步；第 4 步是完成页，不计入步骤。 */
    const totalSteps = 3;
    const [finishing, setFinishing] = useState(false);

    // Step 1：存储位置
    const [storagePath, setStoragePath] = useState('');
    const [storageAvailable, setStorageAvailable] = useState(true);
    const [choosingStorage, setChoosingStorage] = useState(false);

    // Step 1：发音与字幕识别模型
    const [ttsStatus, setTtsStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [downloadingTts, setDownloadingTts] = useState(false);
    const [ttsProgress, setTtsProgress] = useState(0);

    // 字幕识别按用户当前识别方式取模型，不在界面上暴露引擎名
    const [transcriptionEngine, setTranscriptionEngine] = useState<TranscriptionEngine>('whisper-cpp');
    const [transcriptionStatus, setTranscriptionStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [downloadingTranscription, setDownloadingTranscription] = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(0);

    // Step 3：翻译与查词档位 + 独立的整句讲解开关
    const [translationTier, setTranslationTier] = useState<TranslationTier>('smart');
    const [sentenceLearning, setSentenceLearning] = useState(false);
    /** 本机硬件信息；未取到时不展示档位建议。 */
    const [hardware, setHardware] = useState<SystemInfo | null>(null);

    const [localAiStatus, setLocalAiStatus] = useState<LocalAiStatus | null>(null);
    const [downloadingLocalAi, setDownloadingLocalAi] = useState(false);
    const [localAiProgress, setLocalAiProgress] = useState(0);

    const [localMtStatus, setLocalMtStatus] = useState<LocalMtStatus | null>(null);
    const [downloadingLocalMt, setDownloadingLocalMt] = useState(false);
    const [localMtProgress, setLocalMtProgress] = useState(0);

    const [openAiKey, setOpenAiKey] = useState('');
    const [openAiEndpoint, setOpenAiEndpoint] = useState('https://api.openai.com');
    const [openAiModel, setOpenAiModel] = useState('');
    const [testingOpenAi, setTestingOpenAi] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    /** 拉取模型状态与凭据；识别方式变化后重新拉取对应模型状态。 */
    const refreshAllStatuses = React.useCallback(async () => {
        try {
            const engine = await settingsApi.getTranscriptionEngine().catch(() => 'whisper-cpp' as const);
            setTranscriptionEngine(engine);
            const [storageStatus, tts, transcription, localAi, localMt, credentials] = await Promise.all([
                settingsApi.getStorageStatus().catch(() => null),
                settingsApi.getSherpaTtsModelStatus().catch(() => null),
                (engine === 'whisper-cpp'
                    ? settingsApi.getWhisperCppModelStatus()
                    : settingsApi.getParakeetModelStatus()
                ).catch(() => null),
                settingsApi.getLocalAiStatus().catch(() => null),
                settingsApi.getLocalMtStatus().catch(() => null),
                settingsApi.getServiceCredentials().catch(() => null),
            ]);
            if (storageStatus) {
                setStoragePath(storageStatus.resolvedPath);
                setStorageAvailable(storageStatus.available);
            }
            if (tts) setTtsStatus(tts);
            if (transcription) setTranscriptionStatus(transcription);
            if (localAi) setLocalAiStatus(localAi);
            if (localMt) setLocalMtStatus(localMt);
            if (credentials?.openai) {
                if (credentials.openai.key) setOpenAiKey(credentials.openai.key);
                if (credentials.openai.endpoint) setOpenAiEndpoint(credentials.openai.endpoint);
                const firstModel = credentials.openai.models[0]?.model;
                if (firstModel) setOpenAiModel((current) => current || firstModel);
            }
        } catch {
            // Ignore error
        }
    }, []);

    /** 读取本机硬件信息：低配机器默认轻量档，并按结果给出档位建议。 */
    useEffect(() => {
        void getSystemInfo().then((info) => {
            setHardware(info);
            setTranslationTier(recommendTier(info));
        });
    }, []);

    useEffect(() => {
        void refreshAllStatuses();
        // 用户可能在文件管理器里删掉或移动模型目录，窗口重新获得焦点时重新检测
        const refreshOnFocus = () => {
            void refreshAllStatuses();
        };
        const refreshOnVisible = () => {
            if (!document.hidden) void refreshAllStatuses();
        };
        window.addEventListener('focus', refreshOnFocus);
        document.addEventListener('visibilitychange', refreshOnVisible);
        return () => {
            window.removeEventListener('focus', refreshOnFocus);
            document.removeEventListener('visibilitychange', refreshOnVisible);
        };
    }, [refreshAllStatuses]);

    // 订阅主进程推送的下载进度（initRendererApis 会把 IPC 事件转成不带前缀的 window 事件）
    useEffect(() => {
        const handleTtsProgress = (event: Event) => {
            const progress = (event as CustomEvent<{
                percent: number;
                downloaded: number;
                total: number;
                phase: ModelDownloadPhase;
            }>).detail;
            setTtsProgress(progress.percent ?? 0);
            if (progress.phase === 'idle') {
                setDownloadingTts(false);
                void refreshAllStatuses();
            }
        };

        const handleTranscriptionProgress = (event: Event) => {
            const progress = (event as CustomEvent<{
                percent: number;
                downloaded: number;
                total: number;
                phase: ModelDownloadPhase;
            }>).detail;
            setTranscriptionProgress(progress.percent ?? 0);
            if (progress.phase === 'idle') {
                setDownloadingTranscription(false);
                void refreshAllStatuses();
            }
        };

        const handleLocalAiProgress = (event: Event) => {
            const detail = (event as CustomEvent<{
                modelId: string;
                phase: 'downloading' | 'verifying' | 'idle';
                downloaded: number;
                total: number;
                percent: number;
            }>).detail;
            if (detail.percent !== undefined) {
                setLocalAiProgress(detail.percent);
            }
            if (detail.phase === 'idle') {
                setDownloadingLocalAi(false);
                void refreshAllStatuses();
            }
        };

        const handleLocalMtProgress = (event: Event) => {
            const detail = (event as CustomEvent<{
                downloaded: number;
                total: number;
                phase: LocalMtStatus['phase'];
            }>).detail;
            setLocalMtProgress(Math.min(100, Math.floor(detail.downloaded / (detail.total || 1) * 100)));
            if (detail.phase === 'idle') {
                setDownloadingLocalMt(false);
                void refreshAllStatuses();
            }
        };

        window.addEventListener('sherpa-tts-model-download-progress', handleTtsProgress);
        window.addEventListener('whisper-cpp-model-download-progress', handleTranscriptionProgress);
        window.addEventListener('parakeet-model-download-progress', handleTranscriptionProgress);
        window.addEventListener('local-ai-model-download-progress', handleLocalAiProgress);
        window.addEventListener('local-mt-download-progress', handleLocalMtProgress);
        return () => {
            window.removeEventListener('sherpa-tts-model-download-progress', handleTtsProgress);
            window.removeEventListener('whisper-cpp-model-download-progress', handleTranscriptionProgress);
            window.removeEventListener('parakeet-model-download-progress', handleTranscriptionProgress);
            window.removeEventListener('local-ai-model-download-progress', handleLocalAiProgress);
            window.removeEventListener('local-mt-download-progress', handleLocalMtProgress);
        };
    }, [refreshAllStatuses]);

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

    const handleDownloadTts = async () => {
        setDownloadingTts(true);
        setTtsProgress(0);
        try {
            await settingsApi.downloadSherpaTtsModel();
        } catch (e) {
            setDownloadingTts(false);
            toast.error(e instanceof Error ? e.message : t('steps.models.ttsDownloadFailed'));
        }
    };

    const handleCancelTts = async () => {
        try {
            await settingsApi.cancelSherpaTtsModelDownload();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : t('steps.models.cancelFailed'));
        }
    };

    const handleDownloadTranscription = async () => {
        setDownloadingTranscription(true);
        setTranscriptionProgress(0);
        try {
            if (transcriptionEngine === 'whisper-cpp') {
                await settingsApi.downloadWhisperCppModel();
            } else {
                await settingsApi.downloadParakeetModel();
            }
        } catch (e) {
            setDownloadingTranscription(false);
            toast.error(e instanceof Error ? e.message : t('steps.models.transcriptionDownloadFailed'));
        }
    };

    const handleCancelTranscription = async () => {
        try {
            if (transcriptionEngine === 'whisper-cpp') {
                await settingsApi.cancelWhisperCppModelDownload();
            } else {
                await settingsApi.cancelParakeetModelDownload();
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : t('steps.models.cancelFailed'));
        }
    };

    const handleDownloadLocalAi = async () => {
        setDownloadingLocalAi(true);
        setLocalAiProgress(0);
        try {
            await settingsApi.downloadLocalAi(LOCAL_AI_DEFAULT_MODEL_ID);
        } catch (e) {
            setDownloadingLocalAi(false);
            toast.error(e instanceof Error ? e.message : t('steps.translation.localModelDownloadFailed'));
        }
    };

    const handleCancelLocalAi = async () => {
        try {
            await settingsApi.cancelLocalAiDownload();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : t('steps.models.cancelFailed'));
        }
    };

    const handleDownloadLocalMt = async () => {
        setDownloadingLocalMt(true);
        setLocalMtProgress(0);
        try {
            await settingsApi.downloadLocalMt();
        } catch (e) {
            setDownloadingLocalMt(false);
            toast.error(e instanceof Error ? e.message : t('steps.translation.localMtDownloadFailed'));
        }
    };

    const handleCancelLocalMt = async () => {
        try {
            await settingsApi.cancelLocalMtDownload();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : t('steps.models.cancelFailed'));
        }
    };

    /** 把当前输入的密钥、接口地址与模型保存到后端，返回归一化后的模型列表。 */
    const persistOpenAiCredentials = async (): Promise<string[]> => {
        const existingCreds = await settingsApi.getServiceCredentials();
        const existingModels = existingCreds.openai.models.map((m) => m.model);
        const model = openAiModel.trim();
        const models = model && !existingModels.includes(model)
            ? [model, ...existingModels]
            : existingModels;
        await settingsApi.saveServiceCredentials({
            ...existingCreds,
            openai: {
                ...existingCreds.openai,
                key: openAiKey.trim(),
                endpoint: openAiEndpoint.trim(),
                models,
            },
        });
        return models;
    };

    const handleTestOpenAi = async () => {
        const model = openAiModel.trim();
        if (!model) {
            setTestResult({ success: false, message: t('steps.translation.testNoModel') });
            return;
        }
        setTestingOpenAi(true);
        setTestResult(null);
        try {
            await persistOpenAiCredentials();
            const result = await settingsApi.testOpenAi(model);
            setTestResult(result);
            if (result.success) {
                toast.success(t('steps.translation.testSuccess'));
            } else {
                toast.error(result.message || t('steps.translation.testFailed'));
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setTestResult({ success: false, message: msg });
            toast.error(msg);
        } finally {
            setTestingOpenAi(false);
        }
    };

    const defaultLocalAiModel = localAiStatus?.models.find((m) => m.modelId === LOCAL_AI_DEFAULT_MODEL_ID);
    const isLocalAiReady = defaultLocalAiModel?.ready ?? false;
    /** 依据内存、核数与 GPU 给出的推荐档位；硬件信息未就绪时为 null。 */
    const recommendedTier: TranslationTier | null = hardware ? recommendTier(hardware) : null;
    /** 选云端档位或开启整句讲解时需要填写云端凭据。 */
    const needsCloud = translationTier === 'cloud' || sentenceLearning;
    /** 选本地智能档位时需要下载智能模型。 */
    const needsLocalLlm = translationTier === 'smart';
    /** 云端凭据未填齐时不允许完成配置，避免存下用不了的引擎。 */
    const cloudIncomplete = needsCloud && (!openAiKey.trim() || !openAiModel.trim());

    /**
     * 保存配置步骤的结果；成功后进入完成页，失败则留在当前步骤让用户重试或跳过。
     */
    const handleFinishConfig = async () => {
        setFinishing(true);
        try {
            const model = openAiModel.trim();
            if (needsCloud || openAiKey.trim()) {
                await persistOpenAiCredentials();
            }

            const currentEngineSettings = await settingsApi.getEngineSelection();
            await settingsApi.saveEngineSelection({
                ...currentEngineSettings,
                openai: needsCloud && model
                    ? {
                        ...currentEngineSettings.openai,
                        enableSentenceLearning: sentenceLearning,
                        featureModels: {
                            sentenceLearning: model,
                            subtitleTranslation: model,
                            dictionary: model,
                        },
                    }
                    : currentEngineSettings.openai,
                providers: {
                    ...currentEngineSettings.providers,
                    ...TIER_ENGINES[translationTier],
                },
            });

            await markOnboardingCompleted(CURRENT_ONBOARDING_VERSION);
            setCurrentStep(4);
        } catch (error) {
            // 保存失败时明确告知用户，不静默丢配置
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setFinishing(false);
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
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                {t('dialogSubtitle')}
                            </p>
                        </div>
                    )}

                    {/* Step Breadcrumb Bar */}
                    {currentStep <= totalSteps && (
                        <div className="flex items-center gap-2 pt-2">
                            {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => (
                                <div
                                    key={step}
                                    className={cn(
                                        'h-1.5 rounded-full transition-all duration-300',
                                        step === currentStep
                                            ? 'w-8 bg-primary'
                                            : step < currentStep
                                            ? 'w-4 bg-primary/40'
                                            : 'w-4 bg-muted'
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Middle Interactive Content */}
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
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                        <Folder className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-xs sm:text-sm">{t('steps.storage.pathLabel')}</div>
                                        <div className="text-xs text-muted-foreground font-mono break-all">
                                            {storagePath || t('steps.storage.pathLoading')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 gap-1.5 text-xs"
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
                        <div className="space-y-4 animate-in fade-in-50 duration-200">
                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-base font-semibold flex items-center justify-center sm:justify-start gap-2">
                                    <Volume2 className="w-4 h-4 text-primary" />
                                    {t('steps.models.title')}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t('steps.models.desc')}
                                </p>
                            </div>

                            <div className="grid gap-3 pt-1">
                                <ModelDownloadRow
                                    icon={Volume2}
                                    title={t('steps.models.ttsTitle')}
                                    description={t('steps.models.ttsDesc')}
                                    sizeLabel={t('steps.models.ttsSize')}
                                    ready={ttsStatus?.ready ?? false}
                                    downloading={downloadingTts}
                                    progress={ttsProgress}
                                    downloadUrls={ttsStatus?.downloadUrls}
                                    targetPath={ttsStatus?.archivePath}
                                    onDownload={handleDownloadTts}
                                    onCancel={handleCancelTts}
                                    onCopy={copyText}
                                    onOpenUrl={openUrl}
                                    onOpenFolder={openFolder}
                                />

                                <ModelDownloadRow
                                    icon={Mic}
                                    title={t('steps.models.transcriptionTitle')}
                                    description={t('steps.models.transcriptionDesc')}
                                    sizeLabel={t('steps.models.transcriptionSize')}
                                    ready={transcriptionStatus?.ready ?? false}
                                    downloading={downloadingTranscription}
                                    progress={transcriptionProgress}
                                    downloadUrls={transcriptionStatus?.downloadUrls}
                                    targetPath={transcriptionStatus?.archivePath}
                                    onDownload={handleDownloadTranscription}
                                    onCancel={handleCancelTranscription}
                                    onCopy={copyText}
                                    onOpenUrl={openUrl}
                                    onOpenFolder={openFolder}
                                />
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                {t('steps.models.downloadNote')}
                            </p>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-4 animate-in fade-in-50 duration-200">
                            <div className="text-center sm:text-left space-y-1">
                                <h3 className="text-base font-semibold flex items-center justify-center sm:justify-start gap-2">
                                    <Languages className="w-4 h-4 text-primary" />
                                    {t('steps.translation.title')}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {t('steps.translation.desc')}
                                </p>
                            </div>

                            {/* 三档方案：横向三列，一次决定字幕翻译与查词用哪套引擎 */}
                            <RadioGroup
                                value={translationTier}
                                onValueChange={(value) => setTranslationTier(value as TranslationTier)}
                                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                            >
                                {TRANSLATION_TIERS.map((tierId) => (
                                    <Label
                                        key={tierId}
                                        htmlFor={`translation-tier-${tierId}`}
                                        className={cn(
                                            'flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-colors',
                                            translationTier === tierId
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border bg-card hover:bg-muted/40',
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value={tierId} id={`translation-tier-${tierId}`} />
                                            <span className="text-sm font-medium text-foreground">
                                                {t(`steps.translation.tier.${tierId}.title`)}
                                            </span>
                                            {recommendedTier === tierId && (
                                                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                                    {t('steps.translation.recommended')}
                                                </span>
                                            )}
                                        </div>
                                        <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            {t(`steps.translation.tier.${tierId}.size`)}
                                        </span>
                                        <span className="text-xs text-muted-foreground leading-relaxed">
                                            {t(`steps.translation.tier.${tierId}.desc`)}
                                        </span>
                                    </Label>
                                ))}
                            </RadioGroup>

                            {hardware && recommendedTier && (
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {hardware.gpuAcceleration === 'none'
                                        ? t('steps.translation.hardwareHintNoGpu', {
                                            memory: hardware.totalMemoryGb,
                                            cores: hardware.cpuCount,
                                            tier: t(`steps.translation.tier.${recommendedTier}.title`),
                                        })
                                        : t('steps.translation.hardwareHintGpu', {
                                            memory: hardware.totalMemoryGb,
                                            cores: hardware.cpuCount,
                                            gpu: GPU_ACCELERATION_LABELS[hardware.gpuAcceleration],
                                            tier: t(`steps.translation.tier.${recommendedTier}.title`),
                                        })}
                                </p>
                            )}

                            {/* 当前档位需要的本地模型 */}
                            {translationTier === 'light' && (
                                <ModelDownloadRow
                                    icon={Cpu}
                                    title={t('steps.translation.localMtTitle')}
                                    description={t('steps.translation.localMtDesc')}
                                    sizeLabel={t('steps.translation.localMtSize')}
                                    ready={localMtStatus?.ready ?? false}
                                    downloading={downloadingLocalMt}
                                    progress={localMtProgress}
                                    downloadUrls={localMtStatus?.downloadUrls}
                                    targetPath={localMtStatus?.modelPath}
                                    onDownload={handleDownloadLocalMt}
                                    onCancel={handleCancelLocalMt}
                                    onCopy={copyText}
                                    onOpenUrl={openUrl}
                                    onOpenFolder={openFolder}
                                />
                            )}

                            {needsLocalLlm && (
                                <ModelDownloadRow
                                    icon={Cpu}
                                    title={t('steps.translation.localLlmTitle')}
                                    description={t('steps.translation.localLlmDesc')}
                                    sizeLabel={t('steps.translation.localLlmSize')}
                                    ready={isLocalAiReady}
                                    downloading={downloadingLocalAi}
                                    progress={localAiProgress}
                                    downloadUrls={defaultLocalAiModel?.downloadUrls}
                                    targetPath={localAiStatus?.modelsDirectory}
                                    onDownload={handleDownloadLocalAi}
                                    onCancel={handleCancelLocalAi}
                                    onCopy={copyText}
                                    onOpenUrl={openUrl}
                                    onOpenFolder={openFolder}
                                />
                            )}

                            {/* 附加功能：与档位无关的独立能力，单独成区，避免看着像和模型一起配的 */}
                            <div className="space-y-2 pt-1">
                                <div className="text-xs font-medium text-muted-foreground">
                                    {t('steps.translation.extrasTitle')}
                                </div>
                            <Label
                                htmlFor="onboarding-sentence-learning"
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                                    sentenceLearning ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40',
                                )}
                            >
                                <Checkbox
                                    id="onboarding-sentence-learning"
                                    checked={sentenceLearning}
                                    onCheckedChange={(checked) => setSentenceLearning(checked === true)}
                                    className="mt-0.5"
                                />
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="text-sm font-medium text-foreground">
                                        {t('steps.translation.sentenceLearningLabel')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('steps.translation.sentenceLearningHint')}
                                    </div>
                                </div>
                            </Label>
                            </div>

                            {/* 云端配置：选云端档位或开启整句讲解时展开 */}
                            {needsCloud && (
                                <div className="border rounded-xl p-4 bg-card shadow-xs space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-foreground">
                                            {t('steps.translation.openaiKeyLabel')}
                                        </Label>
                                        <Input
                                            type="password"
                                            value={openAiKey}
                                            onChange={(e) => setOpenAiKey(e.target.value)}
                                            placeholder={t('steps.translation.openaiKeyPlaceholder')}
                                            className="h-8.5 text-xs"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-foreground">
                                            {t('steps.translation.openaiEndpointLabel')}
                                        </Label>
                                        <Input
                                            value={openAiEndpoint}
                                            onChange={(e) => setOpenAiEndpoint(e.target.value)}
                                            placeholder={t('steps.translation.openaiEndpointPlaceholder')}
                                            className="h-8.5 text-xs font-mono"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-foreground">
                                            {t('steps.translation.openaiModelLabel')}
                                        </Label>
                                        <Input
                                            value={openAiModel}
                                            onChange={(e) => setOpenAiModel(e.target.value)}
                                            placeholder={t('steps.translation.openaiModelPlaceholder')}
                                            className="h-8.5 text-xs font-mono"
                                        />
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {t('steps.translation.openaiModelHint')}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-1">
                                        <div className="min-w-0">
                                            {testResult && (
                                                <span className={cn(
                                                    'flex items-center gap-1.5 text-xs font-medium',
                                                    testResult.success ? 'text-emerald-500' : 'text-destructive'
                                                )}>
                                                    {testResult.success ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                                    )}
                                                    <span className="truncate" title={testResult.message}>
                                                        {testResult.success
                                                            ? t('steps.translation.testSuccess')
                                                            : testResult.message || t('steps.translation.testFailed')}
                                                    </span>
                                                </span>
                                            )}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={testingOpenAi || !openAiKey.trim() || !openAiModel.trim()}
                                            onClick={handleTestOpenAi}
                                            className="h-7.5 min-w-24 justify-center text-xs gap-1.5 whitespace-nowrap"
                                        >
                                            {testingOpenAi ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    {t('steps.translation.testing')}
                                                </>
                                            ) : (
                                                <>
                                                    <TestTube className="w-3.5 h-3.5" />
                                                    {t('steps.translation.testConnection')}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {cloudIncomplete && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                                    {t('steps.translation.cloudIncompleteHint')}
                                </p>
                            )}
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
                            onClick={handleSkip}
                        >
                            {t('skip')}
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
                                disabled={finishing || cloudIncomplete}
                                onClick={handleFinishConfig}
                            >
                                {finishing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Check className="w-3.5 h-3.5" />
                                )}
                                {t('finishConfig')}
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
