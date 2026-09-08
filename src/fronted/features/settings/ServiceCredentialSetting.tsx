import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import {
    Book,
    Bot,
    CheckCircle2,
    Cpu,
    Trash2,
    FolderOpen,
    Languages,
    Plus,
    TestTube,
    XCircle,
} from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/fronted/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import LocalModelCard from '@/fronted/features/settings/components/LocalModelCard';
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
