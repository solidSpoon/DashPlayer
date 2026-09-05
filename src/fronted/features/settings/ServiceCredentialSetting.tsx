import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import {
    Book,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Copy,
    Cpu,
    Download,
    ExternalLink,
    FolderOpen,
    HelpCircle,
    Languages,
    Loader2,
    Plus,
    ShieldCheck,
    Square,
    TestTube,
    Trash2,
    XCircle,
} from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { Progress } from '@/fronted/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/fronted/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { OpenAiModelUsageFeature, ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import type { LocalAiModelStatus, LocalAiStatus } from '@/common/contracts/local-ai';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/fronted/components/ui/context-menu';

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
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});
    const [parakeetModelStatus, setParakeetModelStatus] = React.useState<ModelInstallationStatusVO | null>(null);
    const [downloadingParakeetModel, setDownloadingParakeetModel] = React.useState(false);
    const [deletingParakeetModel, setDeletingParakeetModel] = React.useState(false);
    const [parakeetDownloadProgress, setParakeetDownloadProgress] = React.useState(0);
    const [parakeetDownloadPhase, setParakeetDownloadPhase] = React.useState<ModelDownloadPhase>('downloading');
    const [sherpaTtsModelStatus, setSherpaTtsModelStatus] = React.useState<ModelInstallationStatusVO | null>(null);
    const [downloadingSherpaTtsModel, setDownloadingSherpaTtsModel] = React.useState(false);
    const [deletingSherpaTtsModel, setDeletingSherpaTtsModel] = React.useState(false);
    const [sherpaTtsDownloadProgress, setSherpaTtsDownloadProgress] = React.useState(0);
    const [sherpaTtsDownloadPhase, setSherpaTtsDownloadPhase] = React.useState<ModelDownloadPhase>('downloading');
    const [localAiStatus, setLocalAiStatus] = React.useState<LocalAiStatus | null>(null);
    const [localAiBusy, setLocalAiBusy] = React.useState(false);

    /** 是否已由用户手动触发下载；用于丢弃过期的状态查询响应。 */
    const downloadingRef = React.useRef(false);
    const sherpaTtsDownloadingRef = React.useRef(false);

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
    const openModelFolder = async (filePath: string) => {
        try {
            await settingsApi.openFolderForFile(filePath);
        } catch (error) {
            toast.error(`${t('common.openFolderFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /** 打开已下载的 Parakeet v3 模型所在目录。 */
    const openParakeetModelFolder = async () => {
        if (parakeetModelStatus?.archivePath) {
            await openModelFolder(parakeetModelStatus.archivePath);
        }
    };

    /** 打开 Sherpa TTS 模型所在的目录。 */
    const openSherpaTtsModelFolder = async () => {
        if (sherpaTtsModelStatus?.archivePath) {
            await openModelFolder(sherpaTtsModelStatus.archivePath);
        }
    };
    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('engineSelection.sentenceLearning.title'),
        subtitleTranslation: t('engineSelection.subtitleTranslation.title'),
        dictionary: t('engineSelection.dictionary.title'),
    }), [t]);

    const openAiModels = watch('openai.models');
    const [newOpenAiModel, setNewOpenAiModel] = React.useState('');

    /**
     * 刷新 Parakeet 模型状态；若期间用户已手动开始下载，丢弃过期响应，避免覆盖进行中的下载状态。
     * 下载任务结束后由主进程广播 idle 终态事件触发本方法，复位 UI。
     */
    const refreshParakeetModelStatus = React.useCallback(async () => {
        const status = await settingsApi.getParakeetModelStatus();
        setParakeetModelStatus(status);
        if (downloadingRef.current) {
            return;
        }
        setDownloadingParakeetModel(status.downloading);
        if (status.phase) {
            setParakeetDownloadPhase(status.phase);
        }
        setParakeetDownloadProgress(status.percent);
    }, []);

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize(settings);
    }, [initialize, settings]);

    React.useEffect(() => {
        refreshParakeetModelStatus().catch(() => null);
    }, [refreshParakeetModelStatus]);

    const refreshSherpaTtsModelStatus = React.useCallback(async () => {
        const status = await settingsApi.getSherpaTtsModelStatus();
        setSherpaTtsModelStatus(status);
        if (sherpaTtsDownloadingRef.current) return;
        setDownloadingSherpaTtsModel(status.downloading);
        if (status.phase) setSherpaTtsDownloadPhase(status.phase);
        setSherpaTtsDownloadProgress(status.percent);
    }, []);

    React.useEffect(() => {
        refreshSherpaTtsModelStatus().catch(() => null);
    }, [refreshSherpaTtsModelStatus]);

    React.useEffect(() => { settingsApi.getLocalAiStatus().then(setLocalAiStatus).catch(() => null); }, []);

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
                settingsApi.getLocalAiStatus().then(setLocalAiStatus).catch(() => null);
            }
        };
        window.addEventListener('local-ai-model-download-progress', handler);
        return () => window.removeEventListener('local-ai-model-download-progress', handler);
    }, []);

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
            settingsApi.getLocalAiStatus().then(setLocalAiStatus).catch(() => null);
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
            settingsApi.getLocalAiStatus().then(setLocalAiStatus).catch(() => null);
        }
    };

    /** 取消当前下载并保留已完成部分，以便下次续传。 */
    const cancelLocalAiDownload = async () => {
        setLocalAiBusy(true);
        try { await settingsApi.cancelLocalAiDownload(); }
        catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
        finally {
            setLocalAiBusy(false);
            settingsApi.getLocalAiStatus().then(setLocalAiStatus).catch(() => null);
        }
    };

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { percent: number; phase?: ModelDownloadPhase } | undefined;
            if (!detail) return;
            // 终态事件：下载任务已在主进程结束（成功/失败/取消），直接复位 UI 并重新查询状态。
            if (detail.phase === 'idle') {
                setDownloadingParakeetModel(false);
                setParakeetDownloadProgress(0);
                setParakeetDownloadPhase('downloading');
                refreshParakeetModelStatus().catch(() => null);
                return;
            }
            if (detail.phase) {
                setParakeetDownloadPhase(detail.phase);
            }
            setParakeetDownloadProgress(detail.percent);

            if (detail.percent >= 100 && detail.phase !== 'extracting' && detail.phase !== 'installing') {
                setTimeout(() => {
                    refreshParakeetModelStatus().catch(() => null);
                }, 300);
            }
        };

        window.addEventListener('parakeet-model-download-progress', handler as EventListener);
        return () => {
            window.removeEventListener('parakeet-model-download-progress', handler as EventListener);
        };
    }, [refreshParakeetModelStatus]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { percent: number; phase?: ModelDownloadPhase } | undefined;
            if (!detail) return;
            if (detail.phase === 'idle') {
                setDownloadingSherpaTtsModel(false);
                setSherpaTtsDownloadProgress(0);
                setSherpaTtsDownloadPhase('downloading');
                refreshSherpaTtsModelStatus().catch(() => null);
                return;
            }
            if (detail.phase) setSherpaTtsDownloadPhase(detail.phase);
            setSherpaTtsDownloadProgress(detail.percent);
        };
        window.addEventListener('sherpa-tts-model-download-progress', handler as EventListener);
        return () => window.removeEventListener('sherpa-tts-model-download-progress', handler as EventListener);
    }, [refreshSherpaTtsModelStatus]);

    /**
     * 测试指定服务商连通性。
     */
    const testProvider = async (provider: 'openai' | 'tencent' | 'youdao') => {
        try {
            await flush();
        } catch (flushError) {
            toast.error(`${t('common.saveFailed')}\n${flushError instanceof Error ? flushError.message : String(flushError)}`);
            return;
        }

        const setTesting = {
            openai: setTestingOpenAi,
            tencent: setTestingTencent,
            youdao: setTestingYoudao,
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

    /**
     * 下载固定的 Parakeet v3 INT8 模型。
     */
    const downloadParakeetModel = async () => {
        downloadingRef.current = true;
        setDownloadingParakeetModel(true);
        setParakeetDownloadProgress(0);
        setParakeetDownloadPhase('downloading');
        try {
            await settingsApi.downloadParakeetModel();
            setParakeetDownloadProgress(100);
            setParakeetDownloadPhase('downloading');
            toast.success(`${t('common.downloadDone')}\nParakeet v3 模型已下载`);
            await refreshParakeetModelStatus();
        } catch (error) {
            toast.error(`${t('common.downloadFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            downloadingRef.current = false;
            setDownloadingParakeetModel(false);
        }
    };

    /**
     * 取消正在进行的 Parakeet v3 模型下载。
     */
    const cancelParakeetDownload = async () => {
        try {
            const result = await settingsApi.cancelParakeetModelDownload();
            if (result.cancelled) {
                setParakeetDownloadPhase('downloading');
                toast.success(t('serviceCredentials.parakeet.downloadCancelled'));
            }
        } catch (error) {
            toast.error(`${t('common.downloadFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    /**
     * 删除已下载的 Parakeet v3 模型并刷新状态。
     */
    const deleteParakeetModel = async () => {
        setDeletingParakeetModel(true);
        try {
            await settingsApi.deleteParakeetModel();
            toast.success(t('serviceCredentials.parakeet.modelDeleted'));
            await refreshParakeetModelStatus();
        } catch (error) {
            toast.error(`${t('serviceCredentials.parakeet.deleteFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setDeletingParakeetModel(false);
        }
    };

    /**
     * 下载固定的 Sherpa-ONNX Piper 英语 TTS 模型。
     */
    const downloadSherpaTtsModel = async () => {
        sherpaTtsDownloadingRef.current = true;
        setDownloadingSherpaTtsModel(true);
        setSherpaTtsDownloadProgress(0);
        setSherpaTtsDownloadPhase('downloading');
        try {
            await settingsApi.downloadSherpaTtsModel();
            toast.success(`${t('common.downloadDone')}\nSherpa TTS 模型已下载`);
            await refreshSherpaTtsModelStatus();
        } catch (error) {
            toast.error(`${t('common.downloadFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        } finally {
            sherpaTtsDownloadingRef.current = false;
            setDownloadingSherpaTtsModel(false);
        }
    };

    /**
     * 取消正在进行的 Sherpa TTS 模型下载。
     */
    const cancelSherpaTtsDownload = async () => {
        const result = await settingsApi.cancelSherpaTtsModelDownload();
        if (result.cancelled) toast.success('Sherpa TTS 模型下载已取消');
    };

    /**
     * 删除已下载的 Sherpa TTS 模型。
     */
    const deleteSherpaTtsModel = async () => {
        setDeletingSherpaTtsModel(true);
        try {
            await settingsApi.deleteSherpaTtsModel();
            toast.success('Sherpa TTS 模型已删除');
            await refreshSherpaTtsModelStatus();
        } finally {
            setDeletingSherpaTtsModel(false);
        }
    };

    const formatProgressPercent = (value: number) => `${Math.min(100, Math.max(0, Math.round(value)))}%`;

    const getPhaseLabel = (phase: ModelDownloadPhase) => {
        if (phase === 'extracting') {
            return t('serviceCredentials.parakeet.extracting');
        }
        if (phase === 'cleaning') {
            return t('serviceCredentials.parakeet.cleaning');
        }
        return t('serviceCredentials.parakeet.downloading');
    };

    const [parakeetGuideOpen, setParakeetGuideOpen] = React.useState(false);
    const [sherpaGuideOpen, setSherpaGuideOpen] = React.useState(false);

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

                {/* 有道词典凭据卡片 */}
                <SettingCard
                    title={t('serviceCredentials.youdao.title')}
                    description={t('serviceCredentials.youdao.description')}
                    icon={Book}
                    headerAction={
                        <div className="flex items-center gap-2">
                            {testResults.youdao && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.youdao.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                                    {testResults.youdao.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.youdao.success ? t('common.testSuccess') : testResults.youdao.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('youdao').catch(() => null)} disabled={testingYoudao || autoSaveStatus === 'saving'}>
                                <TestTube className="w-3.5 h-3.5 mr-1.5" />
                                {testingYoudao ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
                    }
                >
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('serviceCredentials.youdao.appId')}</Label>
                            <Input {...register('youdao.secretId')} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('serviceCredentials.youdao.appKey')}</Label>
                            <Input type="password" {...register('youdao.secretKey')} />
                        </div>
                    </div>
                </SettingCard>

                {/* 英语字幕识别模型卡片 */}
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
                                onClick={openParakeetModelFolder}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                打开存放目录
                            </Button>
                        )
                    }
                >
                    <div className="p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/50">
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-sm font-semibold text-foreground">Parakeet TDT 0.6B v3</span>
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">~640 MB</span>
                                    {parakeetModelStatus?.ready ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {t('common.ready')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {t('common.notDownloaded')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    离线 ASR 语音转文字核心引擎，安装后无需网络即可秒速识别。
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {downloadingParakeetModel ? (
                                    parakeetDownloadPhase === 'downloading' ? (
                                        <Button type="button" variant="outline" size="sm" onClick={() => cancelParakeetDownload().catch(() => null)}>
                                            <Square className="w-3.5 h-3.5 mr-1.5 text-destructive" />
                                            {t('serviceCredentials.parakeet.cancelDownload')}
                                        </Button>
                                    ) : (
                                        <Button type="button" variant="outline" size="sm" disabled>
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            {t('serviceCredentials.parakeet.installing')}
                                        </Button>
                                    )
                                ) : (
                                    <>
                                        {!parakeetModelStatus?.ready && (
                                            <Button type="button" size="sm" onClick={() => downloadParakeetModel().catch(() => null)}>
                                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                                {t('common.download')}
                                            </Button>
                                        )}
                                        {parakeetModelStatus?.ready && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deletingParakeetModel}>
                                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                                        {t('serviceCredentials.parakeet.deleteModel')}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('serviceCredentials.parakeet.deleteConfirmTitle')}</AlertDialogTitle>
                                                        <AlertDialogDescription>{t('serviceCredentials.parakeet.deleteConfirmDescription')}</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('serviceCredentials.parakeet.cancelDelete')}</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteParakeetModel().catch(() => null)}>{t('serviceCredentials.parakeet.confirmDelete')}</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {downloadingParakeetModel && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/40">
                                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                    <span>{getPhaseLabel(parakeetDownloadPhase)}</span>
                                    <span>{formatProgressPercent(parakeetDownloadProgress)}</span>
                                </div>
                                <Progress value={parakeetDownloadProgress} className="h-1.5" />
                            </div>
                        )}

                        {/* 未就绪时提供可折叠的手动安装指引 */}
                        {!parakeetModelStatus?.ready && parakeetModelStatus && (
                            <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setParakeetGuideOpen((open) => !open)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        网络不佳？查看手动下载与安装指南
                                    </span>
                                    {parakeetGuideOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>

                                {parakeetGuideOpen && (
                                    <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">1. 下载压缩包文件：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{parakeetModelStatus.downloadUrl}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(parakeetModelStatus.downloadUrl)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制下载链接
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDownloadUrl(parakeetModelStatus.downloadUrl)}>
                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                        在浏览器中打开
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">2. 将下载的文件保存到指定路径：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{parakeetModelStatus.archivePath}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(parakeetModelStatus.archivePath)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制目标路径
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openParakeetModelFolder}>
                                                        <FolderOpen className="w-3 h-3 mr-1" />
                                                        一键打开目标文件夹
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                                            <span className="font-semibold text-foreground">3. 完成安装：</span>
                                            <span>文件放入上述目录后，点击上方的「下载」按钮，应用会自动识别并解压生效。</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </SettingCard>

                <SettingCard title="本地 AI 模型" description="Qwen3 系列 GGUF 模型，供字幕翻译和词典查询离线使用；可下载多个模型，其中一个作为使用中的模型，全部本地功能共用。" icon={Bot}>
                    <div className="flex flex-col gap-3 p-4">
                        {localAiStatus?.models.map((model) => {
                            const anyDownloading = (localAiStatus?.models.some((item) => item.phase !== 'idle')) ?? false;
                            return (
                                <div key={model.modelId} className="space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="text-sm font-semibold text-foreground">{model.name}</span>
                                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{model.sizeLabel}</span>
                                            {model.ready && model.modelId === localAiStatus.activeModelId ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    {t('serviceCredentials.localAi.inUse')}
                                                </span>
                                            ) : model.ready ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {t('serviceCredentials.localAi.readyNotInUse')}
                                                </span>
                                            ) : model.phase !== 'idle' ? (                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    {model.phase === 'verifying' ? '校验中' : '下载中'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {t('common.notDownloaded')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {!model.ready && model.phase === 'idle' && (
                                                <Button type="button" size="sm" disabled={localAiBusy || anyDownloading} onClick={() => downloadLocalAi(model.modelId, model.name)}>
                                                    <Download className="mr-1.5 h-3.5 w-3.5" />
                                                    {t('common.download')}
                                                </Button>
                                            )}
                                            {!model.ready && model.phase !== 'idle' && (
                                                <Button type="button" variant="outline" size="sm" disabled={localAiBusy} onClick={() => cancelLocalAiDownload()}>
                                                    <Square className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                                                    取消下载
                                                </Button>
                                            )}
                                            {model.ready && model.modelId !== localAiStatus.activeModelId && (
                                                <Button type="button" size="sm" disabled={localAiBusy} onClick={() => runLocalAiAction(model.modelId, model.name, () => settingsApi.useLocalAiModel(model.modelId), t('serviceCredentials.localAi.useSuccess'))}>
                                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                    {t('serviceCredentials.localAi.use')}
                                                </Button>
                                            )}
                                            {model.ready && (
                                                <Button type="button" variant="outline" size="sm" disabled={localAiBusy} onClick={() => runLocalAiAction(model.modelId, model.name, () => settingsApi.checkLocalAi(model.modelId), '最小推理检查通过')}>
                                                    <TestTube className="mr-1.5 h-3.5 w-3.5" />
                                                    检查运行
                                                </Button>
                                            )}
                                            {model.ready && (
                                                <Button type="button" variant="ghost" size="sm" disabled={localAiBusy} onClick={() => runLocalAiAction(model.modelId, model.name, () => settingsApi.deleteLocalAi(model.modelId), '模型已删除')}>
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    删除
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {!model.ready && model.phase !== 'idle' && (
                                        <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/30 p-3">
                                            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                                <span>{model.phase === 'verifying' ? '正在校验模型…' : '正在下载模型…'}</span>
                                                <span>{Math.min(100, Math.floor(model.downloaded / model.total * 100))}%</span>
                                            </div>
                                            <Progress value={model.downloaded / model.total * 100} className="h-1.5" />
                                        </div>
                                    )}
                                    {model.error && (
                                        <div className="text-xs text-destructive">{model.error}</div>
                                    )}
                                    <div className="break-all text-xs text-muted-foreground">{model.modelPath}</div>
                                </div>
                            );
                        })}
                        <div className="text-xs text-muted-foreground">
                            {localAiStatus?.runtimeReady ? 'llama.cpp 运行时已就绪，所有模型共用同一运行时。' : '运行时未安装：请重新执行 yarn run download 或重新安装应用'}
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
                                onClick={openSherpaTtsModelFolder}
                            >
                                <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                                打开存放目录
                            </Button>
                        )
                    }
                >
                    <div className="p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/50">
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-sm font-semibold text-foreground">Piper en_US Amy Low</span>
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">~18 MB</span>
                                    {sherpaTtsModelStatus?.ready ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {t('common.ready')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {t('common.notDownloaded')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    轻量级本地神经发音合成模型，无需消耗云端 API 额度。
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {downloadingSherpaTtsModel ? (
                                    sherpaTtsDownloadPhase === 'downloading' ? (
                                        <Button type="button" variant="outline" size="sm" onClick={() => cancelSherpaTtsDownload().catch(() => null)}>
                                            <Square className="w-3.5 h-3.5 mr-1.5 text-destructive" />
                                            取消下载
                                        </Button>
                                    ) : (
                                        <Button type="button" variant="outline" size="sm" disabled>
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            安装中
                                        </Button>
                                    )
                                ) : (
                                    <>
                                        {!sherpaTtsModelStatus?.ready && (
                                            <Button type="button" size="sm" onClick={() => downloadSherpaTtsModel().catch(() => null)}>
                                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                                {t('common.download')}
                                            </Button>
                                        )}
                                        {sherpaTtsModelStatus?.ready && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deletingSherpaTtsModel}>
                                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                                        删除模型
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>删除 Sherpa TTS 模型？</AlertDialogTitle>
                                                        <AlertDialogDescription>删除后将无法使用本地离线朗读功能，随时可以重新下载。</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => deleteSherpaTtsModel().catch(() => null)}>确认删除</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {downloadingSherpaTtsModel && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/40">
                                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                    <span>{sherpaTtsDownloadPhase === 'extracting' ? '正在解压模型…' : '正在下载模型…'}</span>
                                    <span>{formatProgressPercent(sherpaTtsDownloadProgress)}</span>
                                </div>
                                <Progress value={sherpaTtsDownloadProgress} className="h-1.5" />
                            </div>
                        )}

                        {/* 未就绪时提供可折叠的手动安装指引 */}
                        {!sherpaTtsModelStatus?.ready && sherpaTtsModelStatus && (
                            <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setSherpaGuideOpen((open) => !open)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        网络不佳？查看手动下载与安装指南
                                    </span>
                                    {sherpaGuideOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>

                                {sherpaGuideOpen && (
                                    <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">1. 下载压缩包文件：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{sherpaTtsModelStatus.downloadUrl}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(sherpaTtsModelStatus.downloadUrl)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制下载链接
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDownloadUrl(sherpaTtsModelStatus.downloadUrl)}>
                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                        在浏览器中打开
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">2. 将下载的文件保存到指定路径：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{sherpaTtsModelStatus.archivePath}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(sherpaTtsModelStatus.archivePath)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制目标路径
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openSherpaTtsModelFolder}>
                                                        <FolderOpen className="w-3 h-3 mr-1" />
                                                        一键打开目标文件夹
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                                            <span className="font-semibold text-foreground">3. 完成安装：</span>
                                            <span>文件放入上述目录后，点击上方的「下载」按钮，应用会自动识别并解压生效。</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceCredentialSetting;
