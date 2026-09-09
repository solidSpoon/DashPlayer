import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Cloud, HardDrive, Languages, Layers, Settings2, Sparkles } from 'lucide-react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Textarea } from '@/fronted/components/ui/textarea';
import { ResourcePackCard } from '@/fronted/features/settings/components/ResourcePackCard';
import { ResourceUsageCard } from '@/fronted/features/settings/components/ResourceUsageCard';
import { LocalLlmCard } from '@/fronted/features/settings/components/LocalLlmCard';
import { OpenAiCredentialCard } from '@/fronted/features/settings/components/OpenAiCredentialCard';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import type { LocalAiModelStatus, LocalAiStatus } from '@/common/contracts/local-ai';
import type { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import type { ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';

/** 内存低于该值（GB）时，本地增强模型跑起来会比较吃力。 */
const ENHANCE_MIN_MEMORY_GB = 8;

/** GPU 后端在提示文案里的显示名（专有名词，不翻译）。 */
const GPU_ACCELERATION_LABELS: Record<'metal' | 'vulkan', string> = {
    metal: 'Metal',
    vulkan: 'Vulkan',
};

/** 本地增强模型的下载进度事件携带的数据。 */
interface LocalAiDownloadProgress {
    modelId: string;
    downloaded: number;
    total: number;
    phase: LocalAiModelStatus['phase'];
}

/**
 * 服务与资源设置页（新版预览）。
 *
 * 把"服务与模型"与"功能设置"两页合并成四块：运行资源包（发音/字幕识别/轻量翻译三合一）、
 * 本地增强（可选）、云端服务（可选）、翻译与查词偏好。旧页面暂时保留，便于对比效果。
 */
const ServiceResourceSetting: React.FC = () => {
    const { t } = useI18nTranslation('settings');

    const { data: settings } = useSWR('settings/service-credentials/detail', () => settingsApi.getServiceCredentials());
    const { data: engineSettings } = useSWR('settings/engine-selection/detail', () => settingsApi.getEngineSelection());
    const { data: hardware } = useSWR('system/info', () => settingsApi.getSystemInfo());
    const { data: fallbackState } = useSWR('settings/resource-fallback/detail', () => settingsApi.getResourceFallback());
    const { data: transcriptionEngineSetting } = useSWR('settings/transcription-engine/detail', () => settingsApi.getTranscriptionEngine());

    const credentialForm = useForm<ServiceCredentialSettingDetailVO>();
    const preferenceForm = useForm<EngineSelectionSettingVO>();

    const {
        ready: credentialReady,
        status: credentialSaveStatus,
        error: credentialSaveError,
        initialize: initializeCredentials,
        flush: flushCredentials,
    } = useAutoSaveSettingsForm<ServiceCredentialSettingDetailVO>({
        form: credentialForm,
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

    const {
        ready: preferenceReady,
        status: preferenceSaveStatus,
        error: preferenceSaveError,
        initialize: initializePreferences,
        flush: flushPreferences,
    } = useAutoSaveSettingsForm<EngineSelectionSettingVO>({
        form: preferenceForm,
        onSave: async (values) => {
            await settingsApi.saveEngineSelection(values);
        },
    });

    const { setValue } = preferenceForm;
    const watched = useWatch({ control: preferenceForm.control });
    const subtitleEngine = watched.providers?.subtitleTranslationEngine;
    const subtitleMode = watched.openai?.subtitleTranslationMode;

    // 云端密钥的连通性测试
    const [testingOpenAiModel, setTestingOpenAiModel] = React.useState<string | null>(null);
    const [openAiTestResults, setOpenAiTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});

    // 本地增强模型
    const [localAiStatus, setLocalAiStatus] = React.useState<LocalAiStatus | null>(null);
    const [localAiBusy, setLocalAiBusy] = React.useState(false);
    const [testingModelId, setTestingModelId] = React.useState<string | null>(null);
    const [testResultsMap, setTestResultsMap] = React.useState<Record<string, {
        success: boolean;
        warmSec: string;
        tps: string;
        errorMessage?: string;
    } | null>>({});

    React.useEffect(() => {
        if (!settings) return;
        initializeCredentials(settings);
    }, [initializeCredentials, settings]);

    React.useEffect(() => {
        if (!engineSettings) return;
        initializePreferences(engineSettings);
    }, [engineSettings, initializePreferences]);

    /** 云端模型列表；字幕翻译、词典与整句讲解共用。 */
    const availableModels = React.useMemo(
        () => settings?.openai.models.map((item) => item.model) ?? [],
        [settings],
    );

    /** 拉取本地增强模型的最新状态。 */
    const refreshLocalAiStatus = React.useCallback(async () => {
        try {
            setLocalAiStatus(await settingsApi.getLocalAiStatus());
        } catch {
            // 状态拉取失败不阻断页面，模型保持"未就绪"
        }
    }, []);

    React.useEffect(() => { void refreshLocalAiStatus(); }, [refreshLocalAiStatus]);

    // 本地增强模型的下载进度：只更新对应那一行，结束后重新拉取完整状态
    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<LocalAiDownloadProgress>).detail;
            setLocalAiStatus((current) => current ? {
                ...current,
                models: current.models.map((model) => model.modelId === progress.modelId
                    ? { ...model, downloaded: progress.downloaded, total: progress.total, phase: progress.phase }
                    : model),
            } : current);
            if (progress.phase === 'idle') void refreshLocalAiStatus();
        };
        window.addEventListener('local-ai-model-download-progress', handler);
        return () => window.removeEventListener('local-ai-model-download-progress', handler);
    }, [refreshLocalAiStatus]);

    /** 内置模型在提示里统一显示为「内置模型」，自定义模型显示用户自己的文件名。 */
    const localAiDisplayName = (model: LocalAiModelStatus): string =>
        model.custom ? model.name : t('serviceCredentials.localAi.builtinModelName');

    /** 对指定本地增强模型执行操作并提示结果。 */
    const runLocalAiAction = async (model: LocalAiModelStatus, action: () => Promise<unknown>, successMessage: string) => {
        setLocalAiBusy(true);
        try {
            await action();
            toast.success(`${localAiDisplayName(model)}: ${successMessage}`);
        } catch (error) {
            toast.error(`${localAiDisplayName(model)}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setLocalAiBusy(false);
            await refreshLocalAiStatus();
        }
    };

    /** 下载指定本地增强模型。 */
    const downloadLocalAi = async (modelId: string) => {
        const model = localAiStatus?.models.find((item) => item.modelId === modelId);
        setLocalAiStatus((current) => current ? {
            ...current,
            models: current.models.map((item) => item.modelId === modelId ? { ...item, phase: 'downloading' } : item),
        } : current);
        try {
            await settingsApi.downloadLocalAi(modelId);
            toast.success(t('common.downloadDone'));
        } catch (error) {
            if (model) {
                toast.error(`${localAiDisplayName(model)}: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            await refreshLocalAiStatus();
        }
    };

    /** 对本地增强模型测速。 */
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
            await refreshLocalAiStatus();
        }
    };

    /** 复制文本到剪贴板。 */
    const copyText = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(t('common.copied'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    /** 在系统浏览器中打开地址。 */
    const openUrl = async (url: string) => {
        try {
            await settingsApi.openUrl(url);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    /** 打开文件所在文件夹。 */
    const openFolder = async (path?: string) => {
        if (!path) return;
        try {
            await settingsApi.openFolderForFile(path);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    /**
     * 测试指定云端模型的连通性。
     *
     * 测试前先保存当前表单，保证测的是刚填的密钥与接口地址。
     */
    const testOpenAiModel = async (model: string) => {
        try {
            await flushCredentials();
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

    /** 把字幕翻译或词典的引擎值拆成"引擎 + 云端模型"两个字段。
     *
     * 下拉项里云端选项形如 `openai:<model>`，本地与关闭选项就是枚举值本身。
     */
    const applyEngineValue = (
        value: string,
        engineKey: 'providers.subtitleTranslationEngine' | 'providers.dictionaryEngine',
        modelField: 'openai.featureModels.subtitleTranslation' | 'openai.featureModels.dictionary',
    ) => {
        const separator = value.indexOf(':');
        const engine = separator === -1 ? value : value.slice(0, separator);
        setValue(engineKey, engine as 'openai' | 'local' | 'local-mt' | 'tencent' | 'none', { shouldDirty: true });
        if (engine === 'openai') {
            setValue(modelField, value.slice(separator + 1), { shouldDirty: true });
        }
    };

    /** 把引擎与云端模型拼成下拉项的值。 */
    const composeEngineValue = (engine: string | undefined, model: string | undefined): string | undefined => {
        if (!engine) return undefined;
        return engine === 'openai' ? `openai:${model ?? ''}` : engine;
    };

    /** 整句讲解当前选中的云端模型；未启用或没配云端时为空。 */
    const sentenceLearningModel = watched.openai?.featureModels?.sentenceLearning ?? '';
    /**
     * 整句讲解下拉的选中值。
     *
     * 只有云端能提供讲解，因此没配置云端模型时一律显示为禁用，不展示一个无法生效的选中项。
     */
    const sentenceLearningValue = availableModels.length > 0 && watched.openai?.enableSentenceLearning
        ? `openai:${sentenceLearningModel}`
        : 'none';

    /**
     * 写回整句讲解的选择：禁用时关掉开关，选中云端模型时同时开开关并记住模型。
     *
     * @param value 下拉项值，`none` 或 `openai:<model>`。
     */
    const applySentenceLearningValue = (value: string) => {
        const separator = value.indexOf(':');
        setValue('openai.enableSentenceLearning', separator !== -1, { shouldDirty: true });
        if (separator !== -1) {
            setValue('openai.featureModels.sentenceLearning', value.slice(separator + 1), { shouldDirty: true });
        }
    };

    /** 渲染云端档位的模型选项；各下拉共用。 */
    const renderCloudModels = (prefix: string) => (
        availableModels.length > 0 ? (
            <SelectGroup>
                <SelectLabel>{t('resources.usage.groupCloud')}</SelectLabel>
                {availableModels.map((model) => (
                    <SelectItem key={`${prefix}-${model}`} value={`openai:${model}`}>{model}</SelectItem>
                ))}
            </SelectGroup>
        ) : null
    );

    /** 本地增强模型的硬件条件提示；硬件信息未就绪时为 undefined。 */
    const enhanceHardwareHint = React.useMemo(() => {
        if (!hardware) return undefined;
        const params = { memory: hardware.totalMemoryGb, cores: hardware.cpuCount };
        if (hardware.totalMemoryGb < ENHANCE_MIN_MEMORY_GB) {
            return t('resources.enhance.hardwareHintLowSpec', params);
        }
        if (hardware.gpuAcceleration === 'none') {
            return t('resources.enhance.hardwareHintNoGpu', params);
        }
        return t('resources.enhance.hardwareHintGpu', {
            ...params,
            gpu: GPU_ACCELERATION_LABELS[hardware.gpuAcceleration],
        });
    }, [hardware, t]);

    if (!credentialReady || !preferenceReady) {
        return (
            <SettingsLoadingSkeleton
                title={t('resources.title')}
                description={t('resources.description')}
            />
        );
    }

    return (
        <form
            className="w-full h-full min-h-0"
            onSubmit={(event) => {
                event.preventDefault();
                Promise.all([flushCredentials(), flushPreferences()]).catch(() => null);
            }}
        >
            <SettingsPageShell
                title={t('resources.title')}
                description={t('resources.description')}
                contentClassName="space-y-6"
            >
                {credentialSaveStatus === 'error' && credentialSaveError && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {credentialSaveError}
                    </div>
                )}
                {preferenceSaveStatus === 'error' && preferenceSaveError && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {preferenceSaveError}
                    </div>
                )}

                {/* ① 当前使用：各功能此刻实际调用的资源 */}
                <SettingCard
                    title={t('resources.usage.title')}
                    description={t('resources.usage.description')}
                    icon={Layers}
                >
                    <ResourceUsageCard
                        subtitleEngine={watched.providers?.subtitleTranslationEngine ?? 'none'}
                        subtitleModel={watched.openai?.featureModels?.subtitleTranslation ?? ''}
                        dictionaryEngine={watched.providers?.dictionaryEngine ?? 'none'}
                        dictionaryModel={watched.openai?.featureModels?.dictionary ?? ''}
                        sentenceLearningEnabled={watched.openai?.enableSentenceLearning ?? false}
                        sentenceModel={watched.openai?.featureModels?.sentenceLearning ?? ''}
                        transcriptionEngine={transcriptionEngineSetting ?? 'whisper-cpp'}
                        fallback={fallbackState ?? null}
                    />
                </SettingCard>

                {/* ② 运行资源包：发音 + 字幕识别 + 轻量翻译 */}
                <SettingCard
                    title={t('resources.pack.title')}
                    description={t('resources.pack.description')}
                    icon={HardDrive}
                >
                    <ResourcePackCard />
                </SettingCard>

                {/* ③ 本地增强：可选的本地大模型，文案强调“在资源包基础上再提升” */}
                <SettingCard
                    title={t('resources.enhance.title')}
                    description={t('resources.enhance.description')}
                    icon={Sparkles}
                >
                    <LocalLlmCard
                        headerless
                        status={localAiStatus}
                        busy={localAiBusy}
                        testingModelId={testingModelId}
                        hardwareHint={enhanceHardwareHint}
                        testResultsMap={testResultsMap}
                        onUseModel={(modelId) => {
                            const model = localAiStatus?.models.find((item) => item.modelId === modelId);
                            if (!model) return;
                            void runLocalAiAction(
                                model,
                                () => settingsApi.useLocalAiModel(modelId),
                                t('serviceCredentials.localAi.useSuccess'),
                            );
                        }}
                        onTestModel={(modelId) => testLocalAiModel(modelId).catch(() => null)}
                        onDownloadModel={(modelId) => downloadLocalAi(modelId).catch(() => null)}
                        onCancelDownload={() => {
                            setLocalAiBusy(true);
                            settingsApi.cancelLocalAiDownload()
                                .catch((error) => toast.error(error instanceof Error ? error.message : String(error)))
                                .finally(() => {
                                    setLocalAiBusy(false);
                                    void refreshLocalAiStatus();
                                });
                        }}
                        onDeleteModel={(modelId) => {
                            const model = localAiStatus?.models.find((item) => item.modelId === modelId);
                            if (!model) return;
                            void runLocalAiAction(
                                model,
                                () => settingsApi.deleteLocalAi(modelId),
                                t('serviceCredentials.localAi.deleteSuccess'),
                            );
                        }}
                        onOpenFolder={(path) => openFolder(path).catch(() => null)}
                        onCopy={(text) => copyText(text).catch(() => null)}
                        onOpenUrl={(url) => openUrl(url).catch(() => null)}
                    />
                </SettingCard>

                {/* ④ 云端服务：可选的云端模型与密钥 */}
                <SettingCard
                    title={t('resources.cloud.title')}
                    description={t('resources.cloud.description')}
                    icon={Cloud}
                >
                    <OpenAiCredentialCard
                        headerless
                        form={credentialForm}
                        testingModel={testingOpenAiModel}
                        testResults={openAiTestResults}
                        onTestModel={(model) => testOpenAiModel(model).catch(() => null)}
                        onModelRemoved={(model) => setOpenAiTestResults((prev) => {
                            const next = { ...prev };
                            delete next[model];
                            return next;
                        })}
                        disabled={credentialSaveStatus === 'saving'}
                    />
                </SettingCard>

                {/* ⑤ 翻译与查词偏好 */}
                <SettingCard
                    title={t('resources.preference.title')}
                    description={t('resources.preference.description')}
                    icon={Languages}
                >
                    <SettingRow
                        title={t('resources.preference.subtitleLabel')}
                        description={t('resources.preference.subtitleDesc')}
                        icon={Languages}
                    >
                        <div className="flex flex-col items-end gap-1.5">
                            <Select
                                value={composeEngineValue(subtitleEngine, watched.openai?.featureModels?.subtitleTranslation)}
                                onValueChange={(value) => applyEngineValue(
                                    value,
                                    'providers.subtitleTranslationEngine',
                                    'openai.featureModels.subtitleTranslation',
                                )}
                            >
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>{t('resources.usage.groupBase')}</SelectLabel>
                                        <SelectItem value="local-mt">{t('resources.pack.itemMt')}</SelectItem>
                                    </SelectGroup>
                                    <SelectGroup>
                                        <SelectLabel>{t('resources.usage.groupEnhance')}</SelectLabel>
                                        <SelectItem value="local">{t('resources.preference.engineLocalAi')}</SelectItem>
                                    </SelectGroup>
                                    {renderCloudModels('subtitle')}
                                    {/* 存储里指向的云端模型已不在可用列表时补一个禁用项，避免下拉显示为空 */}
                                    {subtitleEngine === 'openai'
                                        && !!watched.openai?.featureModels?.subtitleTranslation
                                        && !availableModels.includes(watched.openai.featureModels.subtitleTranslation) && (
                                        <SelectItem value={`openai:${watched.openai.featureModels.subtitleTranslation}`} disabled>
                                            {watched.openai.featureModels.subtitleTranslation}
                                        </SelectItem>
                                    )}
                                    <SelectItem value="none">{t('resources.preference.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {subtitleEngine === 'local' && !(localAiStatus?.models.some((model) => model.ready) ?? false) && (
                                <div className="text-xs text-destructive">{t('resources.preference.notReadyHint')}</div>
                            )}
                        </div>
                    </SettingRow>

                    <SettingRow
                        title={t('resources.preference.styleLabel')}
                        icon={Settings2}
                        alignTop={subtitleMode === 'custom'}
                    >
                        {subtitleEngine === 'local-mt' ? (
                            <div className="text-xs text-muted-foreground">{t('resources.preference.localMtZhOnlyHint')}</div>
                        ) : (
                            <div className="flex w-72 flex-col gap-2">
                                <Select
                                    value={watched.openai?.subtitleTranslationMode}
                                    onValueChange={(value: 'zh' | 'simple_en' | 'custom') => {
                                        setValue('openai.subtitleTranslationMode', value, { shouldDirty: true });
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zh">{t('resources.preference.styleZh')}</SelectItem>
                                        <SelectItem value="simple_en">{t('resources.preference.styleSimpleEn')}</SelectItem>
                                        <SelectItem value="custom">{t('resources.preference.styleCustom')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {subtitleMode === 'custom' && (
                                    <Textarea
                                        value={watched.openai?.subtitleCustomStyle}
                                        onChange={(event) => {
                                            setValue('openai.subtitleCustomStyle', event.target.value, { shouldDirty: true });
                                        }}
                                        placeholder={t('resources.preference.stylePlaceholder')}
                                        className="min-h-[100px] resize-none text-xs"
                                    />
                                )}
                            </div>
                        )}
                    </SettingRow>

                    <SettingRow
                        title={t('resources.preference.dictionaryLabel')}
                        description={t('resources.preference.dictionaryDesc')}
                        icon={Languages}
                    >
                        <div className="flex flex-col items-end gap-1.5">
                            <Select
                                value={composeEngineValue(watched.providers?.dictionaryEngine, watched.openai?.featureModels?.dictionary)}
                                onValueChange={(value) => applyEngineValue(
                                    value,
                                    'providers.dictionaryEngine',
                                    'openai.featureModels.dictionary',
                                )}
                            >
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>{t('resources.usage.groupBase')}</SelectLabel>
                                        <SelectItem value="none">{t('resources.preference.engineNoSupplement')}</SelectItem>
                                    </SelectGroup>
                                    <SelectGroup>
                                        <SelectLabel>{t('resources.usage.groupEnhance')}</SelectLabel>
                                        <SelectItem value="local">{t('resources.preference.engineLocalAi')}</SelectItem>
                                    </SelectGroup>
                                    {renderCloudModels('dictionary')}
                                    {/* 存储里指向的云端模型已不在可用列表时补一个禁用项，避免下拉显示为空 */}
                                    {watched.providers?.dictionaryEngine === 'openai'
                                        && !!watched.openai?.featureModels?.dictionary
                                        && !availableModels.includes(watched.openai.featureModels.dictionary) && (
                                        <SelectItem value={`openai:${watched.openai.featureModels.dictionary}`} disabled>
                                            {watched.openai.featureModels.dictionary}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {watched.providers?.dictionaryEngine === 'local'
                                && !(localAiStatus?.models.some((model) => model.ready) ?? false) && (
                                <div className="text-xs text-destructive">{t('resources.preference.notReadyHint')}</div>
                            )}
                        </div>
                    </SettingRow>

                    <SettingRow
                        title={t('resources.preference.sentenceLabel')}
                        description={t('resources.preference.sentenceDesc')}
                        icon={Settings2}
                    >
                        <Select value={sentenceLearningValue} onValueChange={applySentenceLearningValue}>
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t('resources.preference.engineDisabled')}</SelectItem>
                                {renderCloudModels('learn')}
                            </SelectContent>
                        </Select>
                    </SettingRow>
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceResourceSetting;
