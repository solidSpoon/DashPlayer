import React, { useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Button } from '@/fronted/components/ui/button';
import { Progress } from '@/fronted/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/fronted/components/ui/radio-group';
import { Label } from '@/fronted/components/ui/label';
import { Input } from '@/fronted/components/ui/input';
import TitleBar from '@/fronted/components/layout/TitleBar/TitleBar';
import {
    CheckCircle2,
    Download,
    FileVideo,
    Folder,
    Languages,
    Loader2,
    Mic,
    Volume2,
    Cloud,
    Cpu,
    ArrowRight,
    ArrowLeft,
    Check,
    Sparkles,
    TestTube,
    XCircle,
} from 'lucide-react';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { ONBOARDING_COMPLETED_VERSION_KEY } from '@/common/constants/systemConfigKeys';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { LocalAiStatus } from '@/common/contracts/local-ai';
import { LOCAL_AI_DEFAULT_MODEL_ID } from '@/common/contracts/local-ai';
import { cn } from '@/fronted/lib/utils';
import toast from 'react-hot-toast';

export const CURRENT_ONBOARDING_VERSION = '1';

export interface OnboardingViewProps {
    onCompleted?: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({
    onCompleted,
}) => {
    const { t } = useI18nTranslation('onboarding');

    const [currentStep, setCurrentStep] = useState<number>(1);
    const totalSteps = 3;

    // Step 1: Model states
    const [ttsStatus, setTtsStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [downloadingTts, setDownloadingTts] = useState(false);
    const [ttsProgress, setTtsProgress] = useState(0);

    const [parakeetStatus, setParakeetStatus] = useState<ModelInstallationStatusVO | null>(null);
    const [downloadingParakeet, setDownloadingParakeet] = useState(false);
    const [parakeetProgress, setParakeetProgress] = useState(0);

    // Step 2: Translation & Engine preferences
    const [selectedEngine, setSelectedEngine] = useState<'local' | 'openai'>('local');

    // Local LLM states
    const [localAiStatus, setLocalAiStatus] = useState<LocalAiStatus | null>(null);
    const [downloadingLocalAi, setDownloadingLocalAi] = useState(false);
    const [localAiProgress, setLocalAiProgress] = useState(0);

    // Cloud OpenAI credential states
    const [openAiKey, setOpenAiKey] = useState('');
    const [openAiEndpoint, setOpenAiEndpoint] = useState('https://api.openai.com');
    const [testingOpenAi, setTestingOpenAi] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Load initial model statuses and credentials
    const refreshAllStatuses = React.useCallback(async () => {
        try {
            const [tts, parakeet, localAi, credentials] = await Promise.all([
                settingsApi.getSherpaTtsModelStatus().catch(() => null),
                settingsApi.getParakeetModelStatus().catch(() => null),
                settingsApi.getLocalAiStatus().catch(() => null),
                settingsApi.getServiceCredentials().catch(() => null),
            ]);
            if (tts) setTtsStatus(tts);
            if (parakeet) setParakeetStatus(parakeet);
            if (localAi) setLocalAiStatus(localAi);
            if (credentials?.openai) {
                if (credentials.openai.key) setOpenAiKey(credentials.openai.key);
                if (credentials.openai.endpoint) setOpenAiEndpoint(credentials.openai.endpoint);
            }
        } catch {
            // Ignore error
        }
    }, []);

    useEffect(() => {
        void refreshAllStatuses();
    }, [refreshAllStatuses]);

    // Progress listeners for background downloads
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

        const handleParakeetProgress = (event: Event) => {
            const progress = (event as CustomEvent<{
                percent: number;
                downloaded: number;
                total: number;
                phase: ModelDownloadPhase;
            }>).detail;
            setParakeetProgress(progress.percent ?? 0);
            if (progress.phase === 'idle') {
                setDownloadingParakeet(false);
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

        window.addEventListener('settings/sherpa-tts-model-download-progress', handleTtsProgress);
        window.addEventListener('settings/parakeet-model-download-progress', handleParakeetProgress);
        window.addEventListener('settings/local-ai-model-download-progress', handleLocalAiProgress);
        return () => {
            window.removeEventListener('settings/sherpa-tts-model-download-progress', handleTtsProgress);
            window.removeEventListener('settings/parakeet-model-download-progress', handleParakeetProgress);
            window.removeEventListener('settings/local-ai-model-download-progress', handleLocalAiProgress);
        };
    }, [refreshAllStatuses]);

    const handleDownloadTts = async () => {
        setDownloadingTts(true);
        try {
            await settingsApi.downloadSherpaTtsModel();
        } catch (e) {
            setDownloadingTts(false);
            toast.error(e instanceof Error ? e.message : '下载发音模型失败');
        }
    };

    const handleDownloadParakeet = async () => {
        setDownloadingParakeet(true);
        try {
            await settingsApi.downloadParakeetModel();
        } catch (e) {
            setDownloadingParakeet(false);
            toast.error(e instanceof Error ? e.message : '下载转录模型失败');
        }
    };

    const handleDownloadLocalAi = async () => {
        setDownloadingLocalAi(true);
        try {
            await settingsApi.downloadLocalAi(LOCAL_AI_DEFAULT_MODEL_ID);
        } catch (e) {
            setDownloadingLocalAi(false);
            toast.error(e instanceof Error ? e.message : '下载本地大模型失败');
        }
    };

    const handleTestOpenAi = async () => {
        setTestingOpenAi(true);
        setTestResult(null);
        try {
            // Temporarily save to backend so testServiceCredential tests the newly entered values
            const existingCreds = await settingsApi.getServiceCredentials();
            await settingsApi.saveServiceCredentials({
                ...existingCreds,
                openai: {
                    ...existingCreds.openai,
                    key: openAiKey.trim(),
                    endpoint: openAiEndpoint.trim(),
                    models: existingCreds.openai.models.map((m) => m.model),
                },
            });
            const result = await settingsApi.testServiceCredential('openai');
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

    const handleComplete = async () => {
        try {
            // 1. If OpenAI chosen or key entered, persist credentials
            if (selectedEngine === 'openai' || openAiKey.trim()) {
                const existingCreds = await settingsApi.getServiceCredentials();
                await settingsApi.saveServiceCredentials({
                    ...existingCreds,
                    openai: {
                        ...existingCreds.openai,
                        key: openAiKey.trim(),
                        endpoint: openAiEndpoint.trim(),
                        models: existingCreds.openai.models.map((m) => m.model),
                    },
                });
            }

            // 2. Persist engine selection
            const currentEngineSettings = await settingsApi.getEngineSelection();
            await settingsApi.saveEngineSelection({
                ...currentEngineSettings,
                providers: {
                    ...currentEngineSettings.providers,
                    subtitleTranslationEngine: selectedEngine,
                    dictionaryEngine: selectedEngine,
                },
            });

            // 3. Mark onboarding complete in system DB
            await backendClient.call('system/config/set', {
                key: ONBOARDING_COMPLETED_VERSION_KEY,
                value: CURRENT_ONBOARDING_VERSION,
            });
        } catch {
            // Ignore error
        }
        onCompleted?.();
    };

    const handleSkip = async () => {
        try {
            await backendClient.call('system/config/set', {
                key: ONBOARDING_COMPLETED_VERSION_KEY,
                value: CURRENT_ONBOARDING_VERSION,
            });
        } catch {
            // Ignore
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
            <main className="flex-1 flex flex-col items-center justify-between px-6 sm:px-12 py-8 max-w-3xl mx-auto w-full overflow-hidden">
                {/* Header & Step Tracker */}
                <div className="w-full flex flex-col items-center text-center space-y-3 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>{t('stepIndicator', { current: currentStep, total: totalSteps })}</span>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                            {t('dialogTitle')}
                        </h1>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            {t('dialogSubtitle')}
                        </p>
                    </div>

                    {/* Step Breadcrumb Bar */}
                    <div className="flex items-center gap-2 pt-2">
                        {[1, 2, 3].map((step) => (
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
                </div>

                {/* Middle Interactive Content */}
                <div className="w-full my-auto py-6 max-w-xl">
                    {currentStep === 1 && (
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
                                {/* TTS Model Card */}
                                <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                                <Volume2 className="w-4.5 h-4.5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-xs sm:text-sm">
                                                    {t('steps.models.ttsTitle')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t('steps.models.ttsDesc')}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            {ttsStatus?.ready ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    {t('steps.models.ttsStatusReady')}
                                                </span>
                                            ) : downloadingTts ? (
                                                <Button size="sm" disabled variant="outline" className="h-8 gap-1.5 text-xs">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    {t('steps.models.ttsStatusDownloading', { percent: ttsProgress })}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1.5 text-xs"
                                                    onClick={handleDownloadTts}
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    {t('steps.models.ttsActionDownload')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {downloadingTts && (
                                        <div className="space-y-1">
                                            <Progress value={ttsProgress} className="h-1.5" />
                                        </div>
                                    )}
                                </div>

                                {/* Parakeet Transcription Model Card */}
                                <div className="border rounded-xl p-4 bg-card shadow-xs flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground shrink-0">
                                                <Mic className="w-4.5 h-4.5" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-xs sm:text-sm">
                                                    {t('steps.models.transcriptionTitle')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {t('steps.models.transcriptionDesc')}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            {parakeetStatus?.ready ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                    {t('steps.models.transcriptionStatusReady')}
                                                </span>
                                            ) : downloadingParakeet ? (
                                                <Button size="sm" disabled variant="outline" className="h-8 gap-1.5 text-xs">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    {t('steps.models.transcriptionStatusDownloading', { percent: parakeetProgress })}
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1.5 text-xs"
                                                    onClick={handleDownloadParakeet}
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    {t('steps.models.transcriptionActionDownload')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {downloadingParakeet && (
                                        <div className="space-y-1">
                                            <Progress value={parakeetProgress} className="h-1.5" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                {t('steps.models.downloadNote')}
                            </p>
                        </div>
                    )}

                    {currentStep === 2 && (
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

                            <RadioGroup
                                value={selectedEngine}
                                onValueChange={(val) => setSelectedEngine(val as 'local' | 'openai')}
                                className="grid gap-3 pt-1"
                            >
                                {/* Local Model Choice */}
                                <div
                                    onClick={() => setSelectedEngine('local')}
                                    className={cn(
                                        'border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-colors shadow-xs',
                                        selectedEngine === 'local'
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'hover:bg-muted/50 bg-card'
                                    )}
                                >
                                    <div className="flex items-start gap-3.5">
                                        <RadioGroupItem value="local" id="local" className="mt-1" />
                                        <div className="flex-1">
                                            <Label htmlFor="local" className="font-semibold text-xs sm:text-sm cursor-pointer flex items-center gap-2">
                                                <Cpu className="w-4 h-4 text-primary" />
                                                {t('steps.translation.optionLocalTitle')}
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                {t('steps.translation.optionLocalDesc')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Local Model In-Place Download Card */}
                                    {selectedEngine === 'local' && (
                                        <div className="mt-1 pt-3 border-t border-border/60 flex flex-col gap-2.5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-medium text-foreground">
                                                        {t('steps.translation.localModelLabel')}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {t('steps.translation.localModelDesc')}
                                                    </div>
                                                </div>

                                                <div className="shrink-0">
                                                    {isLocalAiReady ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                            {t('steps.translation.localModelReady')}
                                                        </span>
                                                    ) : downloadingLocalAi ? (
                                                        <Button size="sm" disabled variant="outline" className="h-7.5 gap-1.5 text-xs">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            {t('steps.translation.localModelDownloading', { percent: localAiProgress })}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7.5 gap-1.5 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleDownloadLocalAi();
                                                            }}
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            {t('steps.translation.localModelActionDownload')}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {downloadingLocalAi && (
                                                <div className="space-y-1">
                                                    <Progress value={localAiProgress} className="h-1.5" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Cloud OpenAI Choice */}
                                <div
                                    onClick={() => setSelectedEngine('openai')}
                                    className={cn(
                                        'border rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-colors shadow-xs',
                                        selectedEngine === 'openai'
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'hover:bg-muted/50 bg-card'
                                    )}
                                >
                                    <div className="flex items-start gap-3.5">
                                        <RadioGroupItem value="openai" id="openai" className="mt-1" />
                                        <div className="flex-1">
                                            <Label htmlFor="openai" className="font-semibold text-xs sm:text-sm cursor-pointer flex items-center gap-2">
                                                <Cloud className="w-4 h-4 text-primary" />
                                                {t('steps.translation.optionOpenAiTitle')}
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                {t('steps.translation.optionOpenAiDesc')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Cloud Credential Input Fields */}
                                    {selectedEngine === 'openai' && (
                                        <div
                                            className="mt-1 pt-3 border-t border-border/60 flex flex-col gap-3"
                                            onClick={(e) => e.stopPropagation()}
                                        >
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

                                            <div className="flex items-center justify-between pt-1">
                                                <div>
                                                    {testResult && (
                                                        <span className={cn(
                                                            'flex items-center gap-1.5 text-xs font-medium',
                                                            testResult.success ? 'text-emerald-500' : 'text-destructive'
                                                        )}>
                                                            {testResult.success ? (
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            )}
                                                            {testResult.success
                                                                ? t('steps.translation.testSuccess')
                                                                : t('steps.translation.testFailed')}
                                                        </span>
                                                    )}
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={testingOpenAi || !openAiKey.trim()}
                                                    onClick={handleTestOpenAi}
                                                    className="h-7.5 text-xs gap-1.5"
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
                                </div>
                            </RadioGroup>

                            <p className="text-xs text-muted-foreground pt-1">
                                {t('steps.translation.cloudSetupTip')}
                            </p>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-4 animate-in fade-in-50 duration-200">
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
                    )}
                </div>

                {/* Footer Controls */}
                <div className="w-full max-w-xl flex items-center justify-between pt-4 border-t border-border/60 shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleSkip}
                    >
                        {t('skip')}
                    </Button>

                    <div className="flex items-center gap-2.5">
                        {currentStep > 1 && (
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

                        {currentStep < totalSteps ? (
                            <Button
                                size="sm"
                                className="h-8.5 px-4 text-xs gap-1.5 rounded-lg"
                                onClick={() => setCurrentStep((s) => Math.min(totalSteps, s + 1))}
                            >
                                {t('nextStep')}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className="h-8.5 px-4 text-xs gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                                onClick={handleComplete}
                            >
                                <Check className="w-3.5 h-3.5" />
                                {t('finish')}
                            </Button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OnboardingView;
