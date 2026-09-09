import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import {
    ServiceCredentialSettingDetailVO,
    ServiceCredentialSettingSaveVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { isCustomModelId, type LocalAiModelStatus, type LocalAiStatus } from '@/common/contracts/local-ai';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import { isUserCancellation } from '@/common/utils/cancellation';
import { useModelInstallation, type ModelInstallationApi } from '@/fronted/features/settings/useModelInstallation';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Cloud, HardDrive } from 'lucide-react';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';

import { OpenAiCredentialCard } from '@/fronted/features/settings/components/OpenAiCredentialCard';
import { LocalTranscriptionCard } from '@/fronted/features/settings/components/LocalTranscriptionCard';
import { LocalLlmCard } from '@/fronted/features/settings/components/LocalLlmCard';
import { LocalMtCard } from '@/fronted/features/settings/components/LocalMtCard';
import { LocalTtsCard } from '@/fronted/features/settings/components/LocalTtsCard';

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
const ServiceCredentialSetting: React.FC = () => {
    const { t } = useI18nTranslation('settings');
    const { data: settings } = useSWR('settings/service-credentials/detail', () =>
        settingsApi.getServiceCredentials(),
    );

    const form = useForm<ServiceCredentialSettingDetailVO>();

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

    const [testingOpenAiModel, setTestingOpenAiModel] = React.useState<string | null>(null);
    const [openAiTestResults, setOpenAiTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});

    // 本地模型状态
    const [localAiStatus, setLocalAiStatus] = React.useState<LocalAiStatus | null>(null);
    const [localMtStatus, setLocalMtStatus] = React.useState<LocalMtStatus | null>(null);
    const [localMtBusy, setLocalMtBusy] = React.useState(false);
    const [localAiBusy, setLocalAiBusy] = React.useState(false);
    const [testingModelId, setTestingModelId] = React.useState<string | null>(null);
    const [testResultsMap, setTestResultsMap] = React.useState<Record<string, {
        success: boolean;
        warmSec: string;
        tps: string;
        errorMessage?: string;
    } | null>>({});

    // 本地模型安装管理 Hook
    const {
        status: parakeetModelStatus,
        downloading: downloadingParakeetModel,
        deleting: deletingParakeetModel,
        progress: parakeetDownloadProgress,
        phase: parakeetDownloadPhase,
        download: downloadParakeetModel,
        cancelDownload: cancelParakeetDownload,
        deleteModel: deleteParakeetModel,
        refresh: refreshParakeetModelStatus,
    } = useModelInstallation({
        api: PARAKEET_MODEL_API,
        progressEventName: 'parakeet-model-download-progress',
        displayName: t('serviceCredentials.transcription.cardTitle'),
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
        refresh: refreshSherpaTtsModelStatus,
    } = useModelInstallation({
        api: SHERPA_TTS_MODEL_API,
        progressEventName: 'sherpa-tts-model-download-progress',
        displayName: t('serviceCredentials.localTts.cardTitle'),
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
        refresh: refreshWhisperCppModelStatus,
    } = useModelInstallation({
        api: WHISPER_CPP_MODEL_API,
        progressEventName: 'whisper-cpp-model-download-progress',
        displayName: t('serviceCredentials.transcription.cardTitle'),
    });

    /** 本地语音识别引擎；whisper.cpp 为默认（核显加速），sherpa-onnx 为 CPU 回退。 */
    const [transcriptionEngine, setTranscriptionEngine] = React.useState<TranscriptionEngine>('whisper-cpp');

    /** 将文本写入剪贴板。 */
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

    /** 打开模型文件所在文件夹。 */
    const openModelFolder = async (filePath: string | undefined) => {
        if (!filePath) return;
        try {
            await settingsApi.openFolderForFile(filePath);
        } catch (error) {
            toast.error(`${t('common.openFolderFailed')}\n${error instanceof Error ? error.message : String(error)}`);
        }
    };

    React.useEffect(() => {
        if (!settings) return;
        initialize(settings);
    }, [initialize, settings]);

    /** 加载本地语音识别引擎设置。 */
    React.useEffect(() => {
        settingsApi.getTranscriptionEngine()
            .then(setTranscriptionEngine)
            .catch(() => null);
    }, []);

    /**
     * 切换本地语音识别引擎并持久化。
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

    /** 对指定本地 LLM 模型执行测速基准测试。 */
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

    /** 提示文案里展示的模型名：内置模型用用途名，自定义模型用用户自己的文件名。 */
    const localAiDisplayName = (modelId: string, name: string): string =>
        isCustomModelId(modelId) ? name : t('serviceCredentials.localAi.builtinModelName');

    /** 对指定本地模型执行操作。 */
    const runLocalAiAction = async (modelId: string, name: string, action: () => Promise<unknown>, successMessage: string) => {
        setLocalAiBusy(true);
        try {
            await action();
            toast.success(`${localAiDisplayName(modelId, name)}: ${successMessage}`);
        } catch (error) {
            toast.error(`${localAiDisplayName(modelId, name)}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLocalAiBusy(false);
            refreshLocalAiStatus();
        }
    };

    /** 下载本地 LLM 模型。 */
    const downloadLocalAi = async (modelId: string, name: string) => {
        setLocalAiStatus((current) => current ? {
            ...current,
            models: current.models.map((model) =>
                model.modelId === modelId ? { ...model, phase: 'downloading' } : model
            ),
        } : current);
        try {
            await settingsApi.downloadLocalAi(modelId);
            toast.success(t('common.downloadDone'));
        } catch (error) {
            if ((error instanceof Error ? error.name : '') !== 'AbortError') {
                toast.error(`${localAiDisplayName(modelId, name)}: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            refreshLocalAiStatus();
        }
    };

    /** 取消当前本地 LLM 下载。 */
    const cancelLocalAiDownload = async () => {
        setLocalAiBusy(true);
        try {
            await settingsApi.cancelLocalAiDownload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
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

    /**
     * 窗口重新获得焦点时重新检测各模型状态。
     *
     * 用户可能在 Finder / 文件管理器里删掉或移动模型目录，挂载时的一次查询无法反映这种外部变更。
     */
    React.useEffect(() => {
        const refreshAll = () => {
            refreshParakeetModelStatus().catch(() => null);
            refreshSherpaTtsModelStatus().catch(() => null);
            refreshWhisperCppModelStatus().catch(() => null);
            refreshLocalAiStatus().catch(() => null);
            refreshLocalMtStatus().catch(() => null);
        };
        const onVisibilityChange = () => {
            if (!document.hidden) refreshAll();
        };
        window.addEventListener('focus', refreshAll);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('focus', refreshAll);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [
        refreshParakeetModelStatus,
        refreshSherpaTtsModelStatus,
        refreshWhisperCppModelStatus,
        refreshLocalAiStatus,
        refreshLocalMtStatus,
    ]);

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

    /** 下载轻量翻译模型。 */
    const downloadLocalMt = async () => {
        setLocalMtStatus((current) => current ? { ...current, phase: 'downloading' } : current);
        try {
            await settingsApi.downloadLocalMt();
            toast.success(t('serviceCredentials.localMt.downloadDone'));
        } catch (error) {
            if (!isUserCancellation(error)) {
                toast.error(error instanceof Error ? error.message : String(error));
            }
        } finally {
            refreshLocalMtStatus();
        }
    };

    /** 取消轻量翻译模型下载。 */
    const cancelLocalMtDownload = async () => {
        setLocalMtBusy(true);
        try {
            await settingsApi.cancelLocalMtDownload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
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
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setLocalMtBusy(false);
            refreshLocalMtStatus();
        }
    };

    /**
     * 测试指定 OpenAI 模型的连通性。
     *
     * 测试前先保存当前表单，保证测的是刚填的密钥与接口地址。
     */
    const testOpenAiModel = async (model: string) => {
        try {
            await flush();
        } catch (flushError) {
            toast.error(`${t('common.saveFailed')}\n${flushError instanceof Error ? flushError.message : String(flushError)}`);
            return;
        }

        setTestingOpenAiModel(model);
        setOpenAiTestResults((prev) => ({ ...prev, [model]: null }));
        try {
            const result = await settingsApi.testOpenAi(model);
            setOpenAiTestResults((prev) => ({ ...prev, [model]: result }));
        } catch (error) {
            setOpenAiTestResults((prev) => ({
                ...prev,
                [model]: { success: false, message: error instanceof Error ? error.message : String(error) },
            }));
        } finally {
            setTestingOpenAiModel(null);
        }
    };

    if (!ready) {
        return (
            <SettingsLoadingSkeleton
                title={t('serviceCredentials.title')}
                description={t('serviceCredentials.description')}
            />
        );
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

                {/* 云端服务卡片 */}
                <SettingCard
                    title={t('serviceCredentials.sections.cloud.title')}
                    description={t('serviceCredentials.sections.cloud.description')}
                    icon={Cloud}
                >
                    <OpenAiCredentialCard
                        form={form}
                        testingModel={testingOpenAiModel}
                        testResults={openAiTestResults}
                        onTestModel={testOpenAiModel}
                        onModelRemoved={(model) => setOpenAiTestResults((prev) => {
                            const next = { ...prev };
                            delete next[model];
                            return next;
                        })}
                        disabled={autoSaveStatus === 'saving'}
                    />
                </SettingCard>

                {/* 本地模型卡片 */}
                <SettingCard
                    title={t('serviceCredentials.sections.local.title')}
                    description={t('serviceCredentials.sections.local.description')}
                    icon={HardDrive}
                >
                    {/* 字幕语音识别卡片 */}
                    <LocalTranscriptionCard
                        transcriptionEngine={transcriptionEngine}
                        onChangeEngine={changeTranscriptionEngine}
                        whisperCppStatus={whisperCppModelStatus}
                        whisperCppDownloading={downloadingWhisperCppModel}
                        whisperCppDeleting={deletingWhisperCppModel}
                        whisperCppProgress={whisperCppDownloadProgress}
                        whisperCppPhase={whisperCppDownloadPhase}
                        onDownloadWhisperCpp={() => downloadWhisperCppModel().catch(() => null)}
                        onCancelWhisperCppDownload={() => cancelWhisperCppDownload().catch(() => null)}
                        onDeleteWhisperCpp={() => deleteWhisperCppModel().catch(() => null)}
                        parakeetStatus={parakeetModelStatus}
                        parakeetDownloading={downloadingParakeetModel}
                        parakeetDeleting={deletingParakeetModel}
                        parakeetProgress={parakeetDownloadProgress}
                        parakeetPhase={parakeetDownloadPhase}
                        onDownloadParakeet={() => downloadParakeetModel().catch(() => null)}
                        onCancelParakeetDownload={() => cancelParakeetDownload().catch(() => null)}
                        onDeleteParakeet={() => deleteParakeetModel().catch(() => null)}
                        onOpenFolder={openModelFolder}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />

                    {/* 本地增强资源包卡片 */}
                    <LocalLlmCard
                        status={localAiStatus}
                        busy={localAiBusy}
                        testingModelId={testingModelId}
                        testResultsMap={testResultsMap}
                        onUseModel={(modelId, name) =>
                            runLocalAiAction(
                                modelId,
                                name,
                                () => settingsApi.useLocalAiModel(modelId),
                                t('serviceCredentials.localAi.useSuccess'),
                            )
                        }
                        onTestModel={testLocalAiModel}
                        onDownloadModel={downloadLocalAi}
                        onCancelDownload={cancelLocalAiDownload}
                        onDeleteModel={(modelId, name) =>
                            runLocalAiAction(
                                modelId,
                                name,
                                () => settingsApi.deleteLocalAi(modelId),
                                t('serviceCredentials.localAi.deleteSuccess'),
                            )
                        }
                        onOpenFolder={openModelFolder}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />

                    {/* 本地快速翻译卡片 */}
                    <LocalMtCard
                        status={localMtStatus}
                        busy={localMtBusy}
                        onDownload={downloadLocalMt}
                        onCancelDownload={cancelLocalMtDownload}
                        onDelete={deleteLocalMt}
                        onOpenFolder={openModelFolder}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />

                    {/* 单词与例句发音卡片 */}
                    <LocalTtsCard
                        status={sherpaTtsModelStatus}
                        downloading={downloadingSherpaTtsModel}
                        deleting={deletingSherpaTtsModel}
                        progress={sherpaTtsDownloadProgress}
                        phase={sherpaTtsDownloadPhase}
                        onDownload={() => downloadSherpaTtsModel().catch(() => null)}
                        onCancelDownload={() => cancelSherpaTtsDownload().catch(() => null)}
                        onDelete={() => deleteSherpaTtsModel().catch(() => null)}
                        onOpenFolder={openModelFolder}
                        onCopy={copyText}
                        onOpenUrl={openDownloadUrl}
                    />
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceCredentialSetting;
