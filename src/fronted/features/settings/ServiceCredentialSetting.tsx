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
import type { ModelDownloadPhase } from '@/common/contracts/model-download-phase';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
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
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});
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
    const [whisperCppGuideOpen, setWhisperCppGuideOpen] = React.useState(false);
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
                    <div className="p-4 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/50">
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-sm font-semibold text-foreground">Parakeet TDT 0.6B v3（GGUF q8_0）</span>
                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">~640 MB</span>
                                    {whisperCppModelStatus?.ready ? (
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
                                    与默认引擎同款模型，由 whisper.cpp 调用核显（Windows/Linux Vulkan、macOS Metal）推理；
                                    设备不支持核显时会显式报错，可切换回 sherpa-onnx 引擎。
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {downloadingWhisperCppModel ? (
                                    whisperCppDownloadPhase === 'downloading' ? (
                                        <Button type="button" variant="outline" size="sm" onClick={() => cancelWhisperCppDownload().catch(() => null)}>
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
                                        {!whisperCppModelStatus?.ready && (
                                            <Button type="button" size="sm" onClick={() => downloadWhisperCppModel().catch(() => null)}>
                                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                                {t('common.download')}
                                            </Button>
                                        )}
                                        {whisperCppModelStatus?.ready && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={deletingWhisperCppModel}>
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
                                                        <AlertDialogAction onClick={() => deleteWhisperCppModel().catch(() => null)}>{t('serviceCredentials.parakeet.confirmDelete')}</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {downloadingWhisperCppModel && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/40">
                                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                    <span>{getPhaseLabel(whisperCppDownloadPhase)}</span>
                                    <span>{formatProgressPercent(whisperCppDownloadProgress)}</span>
                                </div>
                                <Progress value={whisperCppDownloadProgress} className="h-1.5" />
                            </div>
                        )}

                        {/* 未就绪时提供可折叠的手动安装指引 */}
                        {!whisperCppModelStatus?.ready && whisperCppModelStatus && (
                            <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setWhisperCppGuideOpen((open) => !open)}
                                    className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        网络不佳？查看手动下载与安装指南
                                    </span>
                                    {whisperCppGuideOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>

                                {whisperCppGuideOpen && (
                                    <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">1. 下载模型文件：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{whisperCppModelStatus.downloadUrl}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(whisperCppModelStatus.downloadUrl)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制下载链接
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDownloadUrl(whisperCppModelStatus.downloadUrl)}>
                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                        在浏览器中打开
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="font-semibold text-foreground">2. 将下载的文件保存到指定路径：</div>
                                            <div className="bg-background/80 rounded border border-border/60 p-2 space-y-1.5 font-mono text-[11px] break-all select-text">
                                                <div className="text-muted-foreground/70">{whisperCppModelStatus.archivePath}</div>
                                                <div className="flex items-center gap-2 pt-1 font-sans">
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyText(whisperCppModelStatus.archivePath)}>
                                                        <Copy className="w-3 h-3 mr-1" />
                                                        复制目标路径
                                                    </Button>
                                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => openModelFolder(whisperCppModelStatus.archivePath)}>
                                                        <FolderOpen className="w-3 h-3 mr-1" />
                                                        一键打开目标文件夹
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5 text-muted-foreground/90 bg-muted/30 p-2 rounded">
                                            <span className="font-semibold text-foreground">3. 完成安装：</span>
                                            <span>文件放入上述目录后，点击上方的「下载」按钮，应用会自动识别并安装生效。</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </SettingCard>
                )}

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
