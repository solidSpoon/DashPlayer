import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import {
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Copy,
    Cpu,
    Download,
    FolderOpen,
    Gauge,
    HelpCircle,
    Languages,
    Loader2,
    Plus,
    RefreshCw,
    Square,
    TestTube,
    Trash2,
    XCircle,
} from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { Progress } from '@/fronted/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/fronted/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import LocalModelCard from '@/fronted/features/settings/components/LocalModelCard';
import { OpenAiModelUsageFeature, ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import type { LocalAiModelStatus, LocalAiStatus } from '@/common/contracts/local-ai';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import { isUserCancellation } from '@/common/utils/cancellation';
import { useModelInstallation, type ModelInstallationApi } from '@/fronted/features/settings/useModelInstallation';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/fronted/components/ui/context-menu';
import { Tabs, TabsList, TabsTrigger } from '@/fronted/components/ui/tabs';

/** Parakeet INT8 模型管理接口；模块级常量，保证 hook 依赖稳定。 */
const PARAKEET_MODEL_API: ModelInstallationApi = {
    getStatus: settingsApi.getParakeetModelStatus,
    download: settingsApi.downloadParakeetModel,
    cancelDownload: settingsApi.cancelParakeetModelDownload,
    deleteModel: settingsApi.deleteParakeetModel,
};

/** Sherpa TTS 模型管理接口；模块级常量，保证 hook 依赖稳定。 */
const SHERPA_TTS_MODEL_API: ModelInstallationApi = {
    getStatus: settingsApi.getSherpaTtsModelStatus,
    download: settingsApi.downloadSherpaTtsModel,
    cancelDownload: settingsApi.cancelSherpaTtsModelDownload,
    deleteModel: settingsApi.deleteSherpaTtsModel,
};

/** whisper.cpp GGUF 模型管理接口；模块级常量，保证 hook 依赖稳定。 */
const WHISPER_CPP_MODEL_API: ModelInstallationApi = {
    getStatus: settingsApi.getWhisperCppModelStatus,
    download: settingsApi.downloadWhisperCppModel,
    cancelDownload: settingsApi.cancelWhisperCppModelDownload,
    deleteModel: settingsApi.deleteWhisperCppModel,
};

/**
 * 服务凭据设置页。
 */
const ServiceCredentialSetting = () => {
    const { t } = useI18nTranslation('settings');
    const { data: settings } = useSWR('settings/service-credentials/detail', () =>
        settingsApi.getServiceCredentials(),
    );

    const form = useForm<ServiceCredentialSettingDetailVO>();
    const { register, setValue, watch } = form;

    const {
        ready,
        status: autoSaveStatus,
        error: autoSaveError,
        initialize,
        flush,
    } = useAutoSaveSettingsForm<ServiceCredentialSettingDetailVO>({
        form,
        onSave: async (values) => {
            const payload: ServiceCredentialSettingSaveVO = {
                ...values,
                openai: {
                    ...values.openai,
                    models: values.openai.models.map((item) => item.model),
                },
            };
            await settingsApi.saveServiceCredentials(payload);
        },
    });

    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});
    const [localAiStatus, setLocalAiStatus] = React.useState<LocalAiStatus | null>(null);
    const [localMtStatus, setLocalMtStatus] = React.useState<LocalMtStatus | null>(null);
    const [localMtBusy, setLocalMtBusy] = React.useState(false);
    const [localAiBusy, setLocalAiBusy] = React.useState(false);
    const [localAiRescanning, setLocalAiRescanning] = React.useState(false);
    const [testingModelId, setTestingModelId] = React.useState<string | null>(null);
    const [testResultsMap, setTestResultsMap] = React.useState<Record<string, {
        success: boolean;
        warmSec: string;
        tps: string;
        errorMessage?: string;
    } | null>>({});
    const [localAiGuideOpen, setLocalAiGuideOpen] = React.useState(false);
    // 三个本地模型卡共用同一套状态与动作逻辑；解构名保持与旧变量一致，卡片 JSX 无需改动。
    const {
        status: parakeetModelStatus,
        downloading: downloadingParakeetModel,
        deleting: deletingParakeetModel,
        progress: parakeetDownloadProgress,
        phase: parakeetDownloadPhase,
        download: downloadParakeetModel,
        cancelDownload: cancelParakeetDownload,
        deleteModel: deleteParakeetModel,
    } = useModelInstallation({
        api: PARAKEET_MODEL_API,
        progressEventName: 'parakeet-model-download-progress',
        displayName: 'Parakeet v3',
    });

    const {
        status: sherpaTtsModelStatus,
        downloading: downloadingSherpaTtsModel,
        deleting: deletingSherpaTtsModel,
        progress: sherpaTtsDownloadProgress,
        phase: sherpaTtsDownloadPhase,
        download: downloadSherpaTtsModel,
        cancelDownload: cancelSherpaTtsDownload,
        deleteModel: deleteSherpaTtsModel,
    } = useModelInstallation({
        api: SHERPA_TTS_MODEL_API,
        progressEventName: 'sherpa-tts-model-download-progress',
        displayName: 'Sherpa TTS',
    });

    const {
        status: whisperCppModelStatus,
        downloading: downloadingWhisperCppModel,
        deleting: deletingWhisperCppModel,
        progress: whisperCppDownloadProgress,
        phase: whisperCppDownloadPhase,
        download: downloadWhisperCppModel,
        cancelDownload: cancelWhisperCppDownload,
        deleteModel: deleteWhisperCppModel,
    } = useModelInstallation({
        api: WHISPER_CPP_MODEL_API,
        progressEventName: 'whisper-cpp-model-download-progress',
        displayName: 'whisper.cpp',
    });

    /** 本地语音识别引擎；whisper.cpp 为默认（核显加速），sherpa-onnx 为 CPU 回退。 */
    const [transcriptionEngine, setTranscriptionEngine] = React.useState<TranscriptionEngine>('whisper-cpp');

    /** 将文本写入剪贴板；右键菜单操作失败时向用户明确反馈。 */
    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('common.copied'));
        } catch (error) {
            toast.error(`${t('common.copyFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /** 在系统默认浏览器中打开模型下载地址。 */
    const openDownloadUrl = async (url: string) => {
        try {
            await settingsApi.openUrl(url);
        } catch (error) {
            toast.error(`${t('common.openUrlFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /** 打开模型归档所在的文件夹。 */
    /** 打开模型文件所在文件夹；尚未生成归档路径时忽略。 */
    const openModelFolder = async (filePath: string | undefined) => {
        if (!filePath) return;
        try {
            await settingsApi.openFolderForFile(filePath);
        } catch (error) {
            toast.error(`${t('common.openFolderFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('engineSelection.sentenceLearning.title'),
        subtitleTranslation: t('engineSelection.subtitleTranslation.title'),
        dictionary: t('engineSelection.dictionary.title'),
    }), [t]);

    const openAiModels = watch('openai.models');
    const [newOpenAiModel, setNewOpenAiModel] = React.useState('');

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize(settings);
    }, [initialize, settings]);

    /** 加载本地语音识别引擎设置；失败时保持默认值并在控制台可见的错误中暴露。 */
    React.useEffect(() => {
        settingsApi.getTranscriptionEngine()
            .then(setTranscriptionEngine)
            .catch(() => null);
    }, []);

    /**
     * 切换本地语音识别引擎并持久化；保存失败时不更新本地状态，下次打开仍显示已保存值。
     *
     * @param engine 目标引擎。
     */
    const changeTranscriptionEngine = async (engine: TranscriptionEngine) => {
        try {
            await settingsApi.saveTranscriptionEngine(engine);
            setTranscriptionEngine(engine);
        } catch (error) {
            toast.error(`${t('common.saveFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /** 拉取本地模型最新状态。 */
    const refreshLocalAiStatus = React.useCallback(async () => {
        try {
            const status = await settingsApi.getLocalAiStatus();
            setLocalAiStatus(status);
        } catch {
            // ignore
        }
    }, []);

    /** 手动点击刷新模型列表。 */
    const handleRescanLocalAi = async () => {
        setLocalAiRescanning(true);
        try {
            const status = await settingsApi.getLocalAiStatus();
            setLocalAiStatus(status);
            toast.success(t('common.refreshed', { defaultValue: '已刷新' }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLocalAiRescanning(false);
        }
    };

    /** 对指定模型执行测试（测速 + 连通性），结果直接记录在对应模型下展示。 */
    const testLocalAiModel = async (modelId: string) => {
        setTestingModelId(modelId);
        try {
            const result = await settingsApi.speedTestLocalAi(modelId);
            setTestResultsMap((prev) => ({
                ...prev,
                [modelId]: {
                    success: true,
                    warmSec: (result.warmMs / 1000).toFixed(1),
                    tps: result.tokensPerSecond === null ? '—' : result.tokensPerSecond.toFixed(1),
                },
            }));
        } catch (error) {
            setTestResultsMap((prev) => ({
                ...prev,
                [modelId]: {
                    success: false,
                    warmSec: '—',
                    tps: '—',
                    errorMessage: error instanceof Error ? error.message : String(error),
                },
            }));
        } finally {
            setTestingModelId(null);
            refreshLocalAiStatus();
        }
    };

    React.useEffect(() => { refreshLocalAiStatus(); }, [refreshLocalAiStatus]);

    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<{
                modelId: string;
                downloaded: number;
                total: number;
                phase: LocalAiModelStatus['phase'];
            }>).detail;
            setLocalAiStatus((current) => current ? {
                ...current,
                models: current.models.map((model) =>
                    model.modelId === progress.modelId
                        ? { ...model, downloaded: progress.downloaded, total: progress.total, phase: progress.phase }
                        : model
                ),
            } : current);
            if (progress.phase === 'idle') {
                refreshLocalAiStatus();
            }
        };
        window.addEventListener('local-ai-model-download-progress', handler);
        return () => window.removeEventListener('local-ai-model-download-progress', handler);
    }, [refreshLocalAiStatus]);

    /**
     * 对指定本地模型执行短操作（检查/删除/取消），完成后刷新整页状态。
     *
     * @param modelId 目标模型标识。
     * @param name 模型展示名，用于提示文案。
     * @param action 要执行的 API 调用。
     * @param successMessage 成功提示文案。
     */
    const runLocalAiAction = async (modelId: string, name: string, action: () => Promise<unknown>, successMessage: string) => {
        setLocalAiBusy(true);
        try { await action(); toast.success(`${name}：${successMessage}`); }
        catch (error) { toast.error(`${name}：${error instanceof Error ? error.message : String(error)}`); }
        finally {
            setLocalAiBusy(false);
            refreshLocalAiStatus();
        }
    };

    /** 下载指定模型；进度由事件持续更新页面，后端同一时间只允许一个下载任务。 */
    const downloadLocalAi = async (modelId: string, name: string) => {
        setLocalAiStatus((current) => current ? {
            ...current,
            models: current.models.map((model) =>
                model.modelId === modelId ? { ...model, phase: 'downloading' } : model
            ),
        } : current);
        try {
            await settingsApi.downloadLocalAi(modelId);
            toast.success(`${name} 下载完成`);
        } catch (error) {
            if ((error instanceof Error ? error.name : '') !== 'AbortError') {
                toast.error(`${name}：${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            refreshLocalAiStatus();
        }
    };

    /** 取消当前下载并保留已完成部分，以便下次续传。 */
    const cancelLocalAiDownload = async () => {
        setLocalAiBusy(true);
        try { await settingsApi.cancelLocalAiDownload(); }
        catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
        finally {
            setLocalAiBusy(false);
            refreshLocalAiStatus();
        }
    };

    /** 拉取轻量翻译模型最新状态。 */
    const refreshLocalMtStatus = React.useCallback(async () => {
        try {
            const status = await settingsApi.getLocalMtStatus();
            setLocalMtStatus(status);
        } catch {
            // ignore
        }
    }, []);

    React.useEffect(() => { refreshLocalMtStatus(); }, [refreshLocalMtStatus]);

    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<{
                downloaded: number;
                total: number;
                phase: LocalMtStatus['phase'];
            }>).detail;
            setLocalMtStatus((current) => current ? {
                ...current,
                downloaded: progress.downloaded,
                total: progress.total,
                phase: progress.phase,
            } : current);
            if (progress.phase === 'idle') {
                refreshLocalMtStatus();
            }
        };
        window.addEventListener('local-mt-download-progress', handler);
        return () => window.removeEventListener('local-mt-download-progress', handler);
    }, [refreshLocalMtStatus]);

    /** 下载轻量翻译模型；进度由事件持续更新页面。 */
    const downloadLocalMt = async () => {
        setLocalMtStatus((current) => current ? { ...current, phase: 'downloading' } : current);
        try {
            await settingsApi.downloadLocalMt();
            toast.success(t('serviceCredentials.localMt.downloadDone'));
        } catch (error) {
            // 取消是预期行为（axios 产生的可能是 CanceledError），不弹错误提示。
            if (!isUserCancellation(error)) {
                toast.error(error instanceof Error ? error.message : String(error));
            }
        } finally {
            refreshLocalMtStatus();
        }
    };

    /** 取消轻量翻译模型下载并保留已完成部分，以便下次续传。 */
    const cancelLocalMtDownload = async () => {
        setLocalMtBusy(true);
        try { await settingsApi.cancelLocalMtDownload(); }
        catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
        finally {
            setLocalMtBusy(false);
            refreshLocalMtStatus();
        }
    };

    /** 删除轻量翻译模型。 */
    const deleteLocalMt = async () => {
        setLocalMtBusy(true);
        try {
            await settingsApi.deleteLocalMt();
            toast.success(t('serviceCredentials.localMt.deleteDone'));
        } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
        finally {
            setLocalMtBusy(false);
            refreshLocalMtStatus();
        }
    };
    /**
     * 测试指定服务商连通性。
     */
    const testProvider = async (provider: 'openai' | 'tencent') => {
        try {
            await flush();
        } catch (flushError) {
            toast.error(`${t('common.saveFailed')}\n${flushError instanceof Error ? flushError.message : String(flushError)}`);
            return;
        }

        const setTesting = {
            openai: setTestingOpenAi,
            tencent: setTestingTencent,
        }[provider];

        setTesting(true);
        setTestResults((prev) => ({ ...prev, [provider]: null }));
        try {
            const result = await settingsApi.testServiceCredential(provider);
            setTestResults((prev) => ({ ...prev, [provider]: result }));
        } catch (error) {
            setTestResults((prev) => ({
                ...prev,
                [provider]: { success: false, message: error instanceof Error ? error.message : String(error) },
            }));
        } finally {
            setTesting(false);
        }
    };

    /**
     * 添加 OpenAI 可用模型。
     */
    const handleAddOpenAiModel = () => {
        const model = newOpenAiModel.trim();
        if (!model) {
            return;
        }
        if (!openAiModels) {
            throw new Error('openai.models 未初始化');
        }
        if (openAiModels.some((item) => item.model === model)) {
            toast.error(`${t('common.saveFailed')}\n${t('serviceCredentials.openai.duplicateModel', { model })}`);
            return;
        }
        setValue(
            'openai.models',
            [...openAiModels, { model, inUseBy: [] }],
            { shouldDirty: true },
        );
        setNewOpenAiModel('');
    };

    /**
     * 删除 OpenAI 可用模型（被占用模型禁止删除）。
     */
    const handleDeleteOpenAiModel = (model: string) => {
        if (!openAiModels) {
            throw new Error('openai.models 未初始化');
        }
        const target = openAiModels.find((item) => item.model === model);
        if (!target) {
            throw new Error(`模型不存在：${model}`);
        }
        if (target.inUseBy.length > 0) {
            return;
        }
        setValue(
            'openai.models',
            openAiModels.filter((item) => item.model !== model),
            { shouldDirty: true },
        );
    };


    if (!ready) {
        return (
            <SettingsLoadingSkeleton
                title={t('serviceCredentials.title')}
                description={t('serviceCredentials.description')}
            />
        );
    }
    if (!openAiModels) {
        throw new Error('openai.models 未初始化');
    }

    return (
        <form
            className="w-full h-full min-h-0"
            onSubmit={(event) => {
                event.preventDefault();
                flush().catch(() => null);
            }}
        >
            <SettingsPageShell
                title={t('serviceCredentials.title')}
                description={t('serviceCredentials.description')}
                contentClassName="space-y-6"
            >
                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}

                {/* OpenAI 凭据卡片 */}
                <SettingCard
                    title="OpenAI"
                    description={t('serviceCredentials.openai.description')}
                    icon={Bot}
                    headerAction={
                        <div className="flex items-center gap-2">
                            {testResults.openai && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.openai.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                    {testResults.openai.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.openai.success ? t('common.testSuccess') : testResults.openai.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('openai').catch(() => null)} disabled={testingOpenAi || autoSaveStatus === 'saving'}>
                                <TestTube className="w-3.5 h-3.5 mr-1.5" />
                                {testingOpenAi ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
                    }
                >
                    <div className="p-4 space-y-4">
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input type="password" {...register('openai.key')} placeholder="sk-..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Endpoint</Label>
                            <Input {...register('openai.endpoint')} placeholder="https://api.openai.com" />
                            <div className="flex items-center justify-between gap-3 pt-1">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-medium">{t('serviceCredentials.openai.autoAppendV1')}</Label>
                                    <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.autoAppendV1Hint')}</div>
                                </div>
                                <Switch
                                    checked={watch('openai.autoAppendV1')}
                                    onCheckedChange={(checked) => setValue('openai.autoAppendV1', checked === true, { shouldDirty: true })}
                                />
                            </div>
                            <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.chatCompletionOnly')}</div>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('serviceCredentials.openai.modelsLabel')}</Label>
                            <div className="rounded-md border border-border/70 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('serviceCredentials.openai.tableModel')}</TableHead>
                                            <TableHead>{t('serviceCredentials.openai.tableUsage')}</TableHead>
                                            <TableHead className="w-28 text-right">{t('serviceCredentials.openai.tableAction')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openAiModels.map((item) => (
                                            <TableRow key={item.model}>
                                                <TableCell className="font-mono text-sm">{item.model}</TableCell>
                                                <TableCell>
                                                    {item.inUseBy.length > 0
                                                        ? item.inUseBy.map((feature) => usageLabelMap[feature]).join(' / ')
                                                        : t('serviceCredentials.openai.usageNone')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={item.inUseBy.length > 0}
                                                        onClick={() => handleDeleteOpenAiModel(item.model)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={newOpenAiModel}
                                    onChange={(event) => setNewOpenAiModel(event.target.value)}
                                    placeholder={t('serviceCredentials.openai.addPlaceholder')}
                                />
                                <Button type="button" variant="outline" onClick={handleAddOpenAiModel}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    {t('serviceCredentials.openai.addButton')}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.usedByHint')}</div>
                        </div>
                    </div>
                </SettingCard>

                {/* 腾讯云凭据卡片 */}
                <SettingCard
                    title={t('serviceCredentials.tencent.title')}
                    description={t('serviceCredentials.tencent.description')}
                    icon={Languages}
                    headerAction={
                        <div className="flex items-center gap-2">
                            {testResults.tencent && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.tencent.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                    {testResults.tencent.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.tencent.success ? t('common.testSuccess') : testResults.tencent.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('tencent').catch(() => null)} disabled={testingOpenAi || autoSaveStatus === 'saving'}>
                                <TestTube className="w-3.5 h-3.5 mr-1.5" />
                                {testingTencent ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
                    }
                >
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>SecretId</Label>
                            <Input {...register('tencent.secretId')} />
                        </div>
                        <div className="space-y-2">
                            <Label>SecretKey</Label>
                            <Input type="password" {...register('tencent.secretKey')} />
                        </div>
                    </div>
                </SettingCard>

                {/* 本地语音识别引擎切换 */}
                <SettingCard
                    title="识别引擎"
                    description="whisper.cpp 默认使用核显加速，识别速度显著更快；sherpa-onnx 为纯 CPU 回退方案。切换后下次生成字幕生效。"
                    icon={Bot}
                >
                    <Tabs value={transcriptionEngine} onValueChange={(value) => changeTranscriptionEngine(value as TranscriptionEngine)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="whisper-cpp">whisper.cpp（核显加速，推荐）</TabsTrigger>
                            <TabsTrigger value="sherpa-onnx">sherpa-onnx（CPU）</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </SettingCard>

                {/* 英语字幕识别模型卡片（sherpa-onnx 引擎） */}
                {transcriptionEngine === 'sherpa-onnx' && (
                <SettingCard
                    title="英语字幕识别模型"
                    description="用于自动识别视频语音并生成双语字幕。"
                    icon={Cpu}
                    headerAction={
                        parakeetModelStatus?.ready && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openModelFolder(parakeetModelStatus.archivePath)}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                打开存放目录
                            </Button>
                        )
                    }
                >
                    <LocalModelCard
                        status={parakeetModelStatus}
                        downloading={downloadingParakeetModel}
                        deleting={deletingParakeetModel}
                        progress={parakeetDownloadProgress}
                        phase={parakeetDownloadPhase}
                        modelLabel="Parakeet TDT 0.6B v3"
                        sizeLabel="~640 MB"
                        description="离线 ASR 语音转文字核心引擎，安装后无需网络即可秒速识别。"
                        step1Title={t('serviceCredentials.localModel.step1Archive')}
                        installHint={t('serviceCredentials.localModel.step3HintArchive')}
                        onDownload={() => downloadParakeetModel().catch(() => null)}
                        onCancelDownload={() => cancelParakeetDownload().catch(() => null)}
                        onDelete={() => deleteParakeetModel().catch(() => null)}
                        onOpenFolder={() => openModelFolder(parakeetModelStatus?.archivePath)}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />
                </SettingCard>
                )}

                {/* 英语字幕识别模型卡片（whisper.cpp 引擎） */}
                {transcriptionEngine === 'whisper-cpp' && (
                <SettingCard
                    title="英语字幕识别模型（whisper.cpp）"
                    description="默认引擎，核显加速识别，比 CPU 方案快数倍；需下载 Parakeet v3 GGUF 模型。"
                    icon={Cpu}
                    headerAction={
                        whisperCppModelStatus?.ready && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openModelFolder(whisperCppModelStatus.archivePath)}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                打开存放目录
                            </Button>
                        )
                    }
                >
                    <LocalModelCard
                        status={whisperCppModelStatus}
                        downloading={downloadingWhisperCppModel}
                        deleting={deletingWhisperCppModel}
                        progress={whisperCppDownloadProgress}
                        phase={whisperCppDownloadPhase}
                        modelLabel="Parakeet TDT 0.6B v3（GGUF q8_0）"
                        sizeLabel="~640 MB"
                        description={<>与默认引擎同款模型，由 whisper.cpp 调用核显（Windows/Linux Vulkan、macOS Metal）推理；设备不支持核显时会显式报错，可切换回 sherpa-onnx 引擎。</>}
                        step1Title={t('serviceCredentials.localModel.step1Raw')}
                        installHint={t('serviceCredentials.localModel.step3HintRaw')}
                        onDownload={() => downloadWhisperCppModel().catch(() => null)}
                        onCancelDownload={() => cancelWhisperCppDownload().catch(() => null)}
                        onDelete={() => deleteWhisperCppModel().catch(() => null)}
                        onOpenFolder={() => openModelFolder(whisperCppModelStatus?.archivePath)}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />
                </SettingCard>
                )}

                <SettingCard
                    title={t('serviceCredentials.localAi.cardTitle')}
                    description={t('serviceCredentials.localAi.cardDescription')}
                    icon={Bot}
                    headerAction={
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={localAiRescanning || !localAiStatus}
                                onClick={handleRescanLocalAi}
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", localAiRescanning && "animate-spin")} />
                                {t('serviceCredentials.localAi.rescan')}
                            </Button>
                            {localAiStatus?.modelsDirectory && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openModelFolder(localAiStatus.modelsDirectory)}
                                >
                                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                    {t('serviceCredentials.localAi.openFolder')}
                                </Button>
                            )}
                        </div>
                    }
                >
                    <div className="p-4 space-y-4">
                        {/* 模型列表 */}
                        <div className="space-y-3">
                            {localAiStatus?.models.map((model) => {
                                const anyDownloading = localAiStatus?.models.some((item) => item.phase !== 'idle') ?? false;
                                const isActive = model.ready && model.modelId === localAiStatus.activeModelId;
                                const isTestingThisModel = testingModelId === model.modelId;
                                const testResult = testResultsMap[model.modelId];

                                return (
                                    <div
                                        key={model.modelId}
                                        className={cn(
                                            "relative rounded-xl border p-3.5 transition-colors",
                                            isActive
                                                ? "border-primary/40 bg-primary/[0.03]"
                                                : "border-border/60 bg-muted/20"
                                        )}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-foreground tracking-tight">{model.name}</span>
                                                    <span className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{model.sizeLabel}</span>
                                                    <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">{t('serviceCredentials.localAi.memoryEstimate', { gb: model.memoryEstimateGb })}</span>
                                                    {model.custom && (
                                                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            {t('serviceCredentials.localAi.custom')}
                                                        </span>
                                                    )}
                                                    {isActive ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {t('serviceCredentials.localAi.inUse')}
                                                        </span>
                                                    ) : model.ready ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                                                            {t('serviceCredentials.localAi.readyNotInUse')}
                                                        </span>
                                                    ) : model.phase !== 'idle' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            {model.phase === 'verifying'
                                                                ? t('serviceCredentials.localAi.phaseVerifying')
                                                                : t('serviceCredentials.localAi.phaseDownloading')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                                                            {t('common.notDownloaded')}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                    {model.custom
                                                        ? model.modelPath
                                                        : t('serviceCredentials.localAi.defaultModelDescription')}
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                                                {!model.ready && model.phase === 'idle' && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={localAiBusy || anyDownloading}
                                                        onClick={() => downloadLocalAi(model.modelId, model.name)}
                                                    >
                                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                                        {t('common.download')}
                                                    </Button>
                                                )}
                                                {!model.ready && model.phase !== 'idle' && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={localAiBusy}
                                                        onClick={() => cancelLocalAiDownload()}
                                                    >
                                                        <Square className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                                                        {t('serviceCredentials.localAi.cancelDownload')}
                                                    </Button>
                                                )}
                                                {model.ready && !isActive && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={localAiBusy || testingModelId !== null}
                                                        onClick={() => runLocalAiAction(model.modelId, model.name, () => settingsApi.useLocalAiModel(model.modelId), t('serviceCredentials.localAi.useSuccess'))}
                                                    >
                                                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                        {t('serviceCredentials.localAi.use')}
                                                    </Button>
                                                )}
                                                {model.ready && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={localAiBusy || testingModelId !== null}
                                                        onClick={() => testLocalAiModel(model.modelId)}
                                                    >
                                                        {isTestingThisModel ? (
                                                            <>
                                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
                                                                {t('serviceCredentials.localAi.testing')}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Gauge className="mr-1.5 h-3.5 w-3.5" />
                                                                {t('serviceCredentials.localAi.test')}
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                {model.ready && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-muted-foreground hover:text-destructive"
                                                                disabled={localAiBusy || testingModelId !== null}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>{t('serviceCredentials.localAi.deleteConfirmTitle')}</AlertDialogTitle>
                                                                <AlertDialogDescription>{t('serviceCredentials.localAi.deleteConfirmDescription')}</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>{t('serviceCredentials.localAi.cancelDelete')}</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => runLocalAiAction(model.modelId, model.name, () => settingsApi.deleteLocalAi(model.modelId), t('serviceCredentials.localAi.deleteSuccess'))}>
                                                                    {t('serviceCredentials.localAi.confirmDelete')}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </div>

                                        {/* 下载/校验进度条 */}
                                        {!model.ready && model.phase !== 'idle' && (
                                            <div className="mt-3 space-y-1.5 rounded-lg border border-border/40 bg-muted/30 p-2.5">
                                                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                                    <span>{model.phase === 'verifying' ? t('serviceCredentials.localAi.phaseVerifying') : t('serviceCredentials.localAi.phaseDownloading')}</span>
                                                    <span>{Math.min(100, Math.floor(model.downloaded / (model.total || 1) * 100))}%</span>
                                                </div>
                                                <Progress value={(model.downloaded / (model.total || 1)) * 100} className="h-1.5" />
                                            </div>
                                        )}

                                        {/* 内嵌测试结果展示 */}
                                        {testResult && (
                                            <div className="mt-2.5 pt-2.5 border-t border-border/40">
                                                {testResult.success ? (
                                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg bg-muted/40 px-3 py-2 border border-border/30 text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                                            <span className="text-muted-foreground">{t('serviceCredentials.localAi.speedWarm')}</span>
                                                            <span className="font-mono font-medium text-foreground">{testResult.warmSec}s</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-muted-foreground">{t('serviceCredentials.localAi.speedTps')}</span>
                                                            <span className="font-mono font-semibold text-primary">{testResult.tps} {t('serviceCredentials.localAi.speedTpsUnit')}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 p-2.5 border border-destructive/20 text-xs text-destructive">
                                                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{testResult.errorMessage || '测试失败'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {model.error && (
                                            <div className="mt-2 text-xs text-destructive">{model.error}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 自定义模型与使用指南 */}
                        <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setLocalAiGuideOpen((open) => !open)}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <HelpCircle className="w-3.5 h-3.5" />
                                    {t('serviceCredentials.localAi.customGuideTitle')}
                                </span>
                                {localAiGuideOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>

                            {localAiGuideOpen && (
                                <div className="p-3.5 pt-2 space-y-3 text-xs border-t border-border/40 text-muted-foreground">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-foreground">1. 准备模型文件：</div>
                                        <p className="leading-relaxed">
                                            从 Hugging Face 等平台下载 Instruct 指令对话版的 GGUF 格式模型（推荐 Qwen 系列，量化版本优先选 <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px] text-foreground">Q4_K_M</code>，体积与效果平衡最佳）。
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="font-semibold text-foreground">2. 放入模型目录：</div>
                                        <div className="bg-background/80 rounded border border-border/60 p-2.5 space-y-2 font-mono text-[11px] break-all select-text">
                                            <div className="text-muted-foreground/70">{localAiStatus?.modelsDirectory ?? ''}</div>
                                            <div className="flex items-center gap-2 pt-1 font-sans">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    disabled={!localAiStatus}
                                                    onClick={() => localAiStatus && copyText(localAiStatus.modelsDirectory)}
                                                >
                                                    <Copy className="w-3 h-3 mr-1" />
                                                    {t('serviceCredentials.localAi.copyPath')}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    disabled={!localAiStatus}
                                                    onClick={() => localAiStatus && openModelFolder(localAiStatus.modelsDirectory)}
                                                >
                                                    <FolderOpen className="w-3 h-3 mr-1" />
                                                    {t('serviceCredentials.localAi.openFolder')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="font-semibold text-foreground">3. 刷新并启用：</div>
                                        <p className="leading-relaxed">
                                            模型放入目录后，点击右上角的「刷新模型列表」，新模型会自动出现在上方并带有「自定义模型」标签。点击「设为使用」后，即可通过「测试」验证运行状态与推理速度。
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 运行时状态底栏 */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/80 px-0.5">
                            <span className={cn("inline-block w-2 h-2 rounded-full", localAiStatus?.runtimeReady ? "bg-green-500" : "bg-amber-500")} />
                            <span>
                                {localAiStatus?.runtimeReady
                                    ? t('serviceCredentials.localAi.runtimeReady')
                                    : t('serviceCredentials.localAi.runtimeMissing')}
                            </span>
                        </div>
                    </div>
                </SettingCard>

                {/* 轻量翻译模型卡片 */}
                <SettingCard
                    title={t('serviceCredentials.localMt.cardTitle')}
                    description={t('serviceCredentials.localMt.cardDescription')}
                    icon={Languages}
                    headerAction={
                        localMtStatus?.modelPath ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openModelFolder(localMtStatus.modelPath)}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                {t('serviceCredentials.localAi.openFolder')}
                            </Button>
                        ) : null
                    }
                >
                    <div className="p-4 space-y-4">
                        <div className={cn(
                            "relative rounded-xl border p-3.5 transition-colors",
                            localMtStatus?.ready
                                ? "border-primary/40 bg-primary/[0.03]"
                                : "border-border/60 bg-muted/20"
                        )}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-foreground tracking-tight">OPUS-MT en→zh</span>
                                        <span className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">~0.3 GB</span>
                                        {localMtStatus?.ready ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {t('serviceCredentials.localAi.readyNotInUse')}
                                            </span>
                                        ) : localMtStatus?.phase !== 'idle' && localMtStatus ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                {localMtStatus.phase === 'verifying'
                                                    ? t('serviceCredentials.localAi.phaseVerifying')
                                                    : t('serviceCredentials.localAi.phaseDownloading')}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                                                {t('common.notDownloaded')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{t('serviceCredentials.localMt.modelNote')}</p>
                                    {localMtStatus?.error && (
                                        <p className="text-xs text-destructive">{localMtStatus.error}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                                    {localMtStatus?.ready ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    disabled={localMtBusy}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('serviceCredentials.localMt.deleteConfirmTitle')}</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {t('serviceCredentials.localMt.deleteConfirmDescription')}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('serviceCredentials.localAi.cancelDelete')}</AlertDialogCancel>
                                                    <AlertDialogAction onClick={deleteLocalMt}>
                                                        {t('serviceCredentials.localAi.confirmDelete')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : localMtStatus && localMtStatus.phase !== 'idle' ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={localMtBusy}
                                            onClick={cancelLocalMtDownload}
                                        >
                                            <Square className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                                            {t('serviceCredentials.localAi.cancelDownload')}
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={localMtBusy}
                                            onClick={downloadLocalMt}
                                        >
                                            <Download className="mr-1.5 h-3.5 w-3.5" />
                                            {t('common.download')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {localMtStatus && localMtStatus.phase !== 'idle' && (
                                <div className="mt-3 space-y-1.5 rounded-lg border border-border/40 bg-muted/30 p-2.5">
                                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                        <span>
                                            {localMtStatus.phase === 'verifying'
                                                ? t('serviceCredentials.localAi.phaseVerifying')
                                                : t('serviceCredentials.localAi.phaseDownloading')}
                                        </span>
                                        <span>{Math.min(100, Math.floor(localMtStatus.downloaded / (localMtStatus.total || 1) * 100))}%</span>
                                    </div>
                                    <Progress
                                        value={(localMtStatus.downloaded / (localMtStatus.total || 1)) * 100}
                                        className="h-1.5"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </SettingCard>


                {/* 英语语音朗读模型卡片 */}
                <SettingCard
                    title="英语语音朗读模型"
                    description="用于英语语音朗读，完全离线生成高质量发音音频。"
                    icon={Cpu}
                    headerAction={
                        sherpaTtsModelStatus?.ready && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openModelFolder(sherpaTtsModelStatus.archivePath)}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                打开存放目录
                            </Button>
                        )
                    }
                >
                    <LocalModelCard
                        status={sherpaTtsModelStatus}
                        downloading={downloadingSherpaTtsModel}
                        deleting={deletingSherpaTtsModel}
                        progress={sherpaTtsDownloadProgress}
                        phase={sherpaTtsDownloadPhase}
                        modelLabel="Piper en_US Amy Low"
                        sizeLabel="~18 MB"
                        description="轻量级本地神经发音合成模型，无需消耗云端 API 额度。"
                        step1Title={t('serviceCredentials.localModel.step1Archive')}
                        installHint={t('serviceCredentials.localModel.step3HintArchive')}
                        onDownload={() => downloadSherpaTtsModel().catch(() => null)}
                        onCancelDownload={() => cancelSherpaTtsDownload().catch(() => null)}
                        onDelete={() => deleteSherpaTtsModel().catch(() => null)}
                        onOpenFolder={() => openModelFolder(sherpaTtsModelStatus?.archivePath)}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceCredentialSetting;
