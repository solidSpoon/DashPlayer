import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { AlertTriangle, BookA, Captions, Cloud, Eraser, HardDrive, Languages, Loader2, Settings2, Sparkles, Volume2 } from 'lucide-react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { Button } from '@/fronted/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { cn } from '@/fronted/lib/utils';
import { Textarea } from '@/fronted/components/ui/textarea';
import { ResourcePackCard } from '@/fronted/features/settings/components/ResourcePackCard';
import { LocalLlmCard } from '@/fronted/features/settings/components/LocalLlmCard';
import { OpenAiCredentialCard } from '@/fronted/features/settings/components/OpenAiCredentialCard';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import { OPENAI_SUBTITLE_DEFAULT_STYLES } from '@/common/constants/openaiSubtitlePrompts';
import type { LocalAiModelStatus } from '@/common/contracts/local-ai';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import type { ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';

/** 内存低于该值（GB）时，本地增强模型跑起来会比较吃力。 */
const ENHANCE_MIN_MEMORY_GB = 8;

/** GPU 后端在提示文案里的显示名（专有名词，不翻译）。 */
const GPU_ACCELERATION_LABELS: Record<'metal' | 'vulkan', string> = {
    metal: 'Metal',
    vulkan: 'Vulkan',
};

/** 卡片头右侧的能力图标。 */
interface CapabilityIcon {
    /** 图标组件。 */
    icon: React.ElementType;
    /** 能力名文案键。 */
    labelKey: string;
    /** 是否能在下方「翻译与查词偏好」里切换（决定悬停提示文案）。 */
    configurable: boolean;
}

const CAPABILITY_TRANSLATION: CapabilityIcon = { icon: Languages, labelKey: 'resources.capability.translation', configurable: true };
const CAPABILITY_DICTIONARY: CapabilityIcon = { icon: BookA, labelKey: 'resources.capability.dictionary', configurable: true };
const CAPABILITY_SENTENCE: CapabilityIcon = { icon: Sparkles, labelKey: 'resources.capability.sentence', configurable: true };
const CAPABILITY_TRANSCRIPTION: CapabilityIcon = { icon: Captions, labelKey: 'resources.capability.transcription', configurable: false };
const CAPABILITY_TTS: CapabilityIcon = { icon: Volume2, labelKey: 'resources.capability.tts', configurable: false };

/** 本地增强模型的下载进度事件携带的数据。 */
interface LocalAiDownloadProgress {
    modelId: string;
    downloaded: number;
    total: number;
    phase: LocalAiModelStatus['phase'];
}

/**
 * 服务与资源设置页。
 *
 * 把“服务与模型”与“功能设置”两页合并成四块：本地基础资源包（发音/字幕识别/轻量翻译三合一）、
 * 本地增强（可选）、云端服务（可选）、翻译与查词偏好。
 */
const ServiceResourceSetting: React.FC = () => {
    const { t } = useI18nTranslation('settings');

    const { data: settings } = useSWR('settings/service-credentials/detail', () => settingsApi.getServiceCredentials());
    const { data: engineSettings } = useSWR('settings/engine-selection/detail', () => settingsApi.getEngineSelection());
    /** 资源状态聚合：三项资源包、本地增强、硬件与回退状态都在这一份里。 */
    const { data: resourceStatus, mutate: refreshResourceStatus } = useSWR(
        'settings/resource-status/detail',
        () => settingsApi.getResourceStatus(),
    );
    const hardware = resourceStatus?.hardware;
    const fallbackState = resourceStatus?.fallback ?? null;
    const localAiStatus = resourceStatus?.localAi ?? null;

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
    /** 词典补充是否走本地增强资源包 / 云端模型。 */
    const dictionaryEngine = watched.providers?.dictionaryEngine;
    /** 整句讲解是否启用。 */
    const sentenceLearningEnabled = watched.openai?.enableSentenceLearning === true;
    /** 哪些引擎是开启的：决定缓存清理行是否展示、清理时跳过谁。 */
    const cacheTargets = {
        subtitle: subtitleEngine !== undefined && subtitleEngine !== 'none' && subtitleEngine !== 'invalid',
        dictionary: dictionaryEngine !== undefined && dictionaryEngine !== 'none' && dictionaryEngine !== 'invalid',
    };

    // 云端密钥的连通性测试
    const [testingOpenAiModel, setTestingOpenAiModel] = React.useState<string | null>(null);
    const [openAiTestResults, setOpenAiTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});

    // 本地增强模型
    const [localAiBusy, setLocalAiBusy] = React.useState(false);
    const [clearingCache, setClearingCache] = React.useState(false);
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
        // 自定义风格留空时，实际生效的是默认风格；直接把默认值填进输入框，让用户看到真实生效的内容
        initializePreferences({
            ...engineSettings,
            openai: {
                ...engineSettings.openai,
                subtitleCustomStyle: engineSettings.openai.subtitleCustomStyle.trim()
                    || OPENAI_SUBTITLE_DEFAULT_STYLES.custom,
            },
        });
    }, [engineSettings, initializePreferences]);

    /** 云端模型列表；字幕翻译、词典与整句讲解共用。 */
    const availableModels = React.useMemo(
        () => settings?.openai.models.map((item) => item.model) ?? [],
        [settings],
    );

    /**
     * 本地增强模型的下载进度：只改动聚合快照里对应那一行，结束后重新拉取完整状态。
     */
    React.useEffect(() => {
        const handler = (event: Event) => {
            const progress = (event as CustomEvent<LocalAiDownloadProgress>).detail;
            void refreshResourceStatus((current) => current ? {
                ...current,
                localAi: {
                    ...current.localAi,
                    models: current.localAi.models.map((model) => model.modelId === progress.modelId
                        ? { ...model, downloaded: progress.downloaded, total: progress.total, phase: progress.phase }
                        : model),
                },
            } : current, { revalidate: false });
            if (progress.phase === 'idle') void refreshResourceStatus();
        };
        window.addEventListener('local-ai-model-download-progress', handler);
        return () => window.removeEventListener('local-ai-model-download-progress', handler);
    }, [refreshResourceStatus]);

    /** 切换字幕识别方式并刷新聚合状态。 */
    const changeTranscriptionEngine = async (engine: TranscriptionEngine) => {
        try {
            await settingsApi.saveTranscriptionEngine(engine);
            await refreshResourceStatus();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    };

    /**
     * 清除当前配置产生的字幕翻译与查词缓存。
     *
     * 只清已启用的引擎：关闭的档位没有缓存，对应接口会直接报"未启用"，
     * 与旧页面按引擎分别渲染按钮的行为一致。
     */
    const clearCaches = async () => {
        setClearingCache(true);
        try {
            const [subtitle, dictionary] = await Promise.all([
                cacheTargets.subtitle ? settingsApi.clearSubtitleTranslationCache() : { deleted: 0 },
                cacheTargets.dictionary ? settingsApi.clearDictionaryCache() : { deleted: 0 },
            ]);
            toast.success(t('resources.preference.clearCacheDone', {
                count: subtitle.deleted + dictionary.deleted,
            }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setClearingCache(false);
        }
    };

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
            await refreshResourceStatus();
        }
    };

    /** 下载指定本地增强模型。 */
    const downloadLocalAi = async (modelId: string) => {
        const model = localAiStatus?.models.find((item) => item.modelId === modelId);
        void refreshResourceStatus((current) => current ? {
            ...current,
            localAi: {
                ...current.localAi,
                models: current.localAi.models.map((item) => item.modelId === modelId ? { ...item, phase: 'downloading' } : item),
            },
        } : current, { revalidate: false });
        try {
            await settingsApi.downloadLocalAi(modelId);
            toast.success(t('common.downloadDone'));
        } catch (error) {
            // 状态未加载完时找不到模型名，也要把失败显式露出来，不能静默吞掉。
            const prefix = model ? `${localAiDisplayName(model)}: ` : '';
            toast.error(`${prefix}${error instanceof Error ? error.message : String(error)}`);
        } finally {
            await refreshResourceStatus();
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
            await refreshResourceStatus();
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

    /** 渲染云端模型选项；各下拉共用，展平不分组。 */
    const renderCloudModels = (prefix: string) => availableModels.map((model) => (
        <SelectItem key={`${prefix}-${model}`} value={`openai:${model}`}>{model}</SelectItem>
    ));

    /** 本地增强资源包的硬件条件提示；硬件信息未就绪时为 undefined。 */
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

    /** 云端是否处于回退中（字幕翻译或词典已落到基础资源）。 */
    const cloudFallback = Boolean(fallbackState?.subtitleTranslation || fallbackState?.dictionary);

    /**
     * 卡片头右侧的能力小图标：标明这一档资源能顶哪些功能。
     *
     * 当前由这一档承担的能力会点亮，其余保持喑淡；悬停弹出说明。
     *
     * @param items 该卡片覆盖的能力及其是否在用。
     * @param showFallback 是否附带回退警告（仅云端卡片传 true）。
     */
    const renderCapabilityIcons = (
        items: { cap: CapabilityIcon; active: boolean }[],
        showFallback = false,
    ) => (
        <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-1.5">
                {items.map(({ cap, active }) => {
                    const Icon = cap.icon;
                    const name = t(cap.labelKey);
                    return (
                        <Tooltip key={cap.labelKey}>
                            <TooltipTrigger asChild>
                                <span className="inline-flex cursor-default items-center p-0.5">
                                    <Icon className={cn(
                                        'h-3.5 w-3.5 transition-colors',
                                        active ? 'text-primary' : 'text-muted-foreground/40',
                                    )} />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                {cap.configurable
                                    ? t('resources.capability.configurableHint', {
                                        name,
                                        card: t('resources.preference.title'),
                                    })
                                    : name}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
                {showFallback && cloudFallback && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex cursor-default items-center p-0.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('resources.capability.fallbackHint')}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );

    // 资源状态聚合未加载完成时整页骨架：避免识别引擎等字段在无数据时猜默认值。
    if (!credentialReady || !preferenceReady || !resourceStatus) {
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

                {/* ① 本地基础资源包：发音 + 字幕识别 + 轻量翻译 */}
                <SettingCard
                    title={t('resources.pack.title')}
                    description={t('resources.pack.description')}
                    icon={HardDrive}
                    headerAction={renderCapabilityIcons([
                        { cap: CAPABILITY_TTS, active: true },
                        { cap: CAPABILITY_TRANSCRIPTION, active: true },
                        { cap: CAPABILITY_TRANSLATION, active: subtitleEngine === 'local-mt' },
                    ])}
                >
                    <ResourcePackCard
                        transcriptionEngine={resourceStatus.transcriptionEngine}
                        ttsStatus={resourceStatus?.tts ?? null}
                        transcriptionStatus={resourceStatus?.transcription ?? null}
                        localMtStatus={resourceStatus?.localMt ?? null}
                        onRefresh={() => { void refreshResourceStatus(); }}
                        onChangeEngine={(engine) => { void changeTranscriptionEngine(engine); }}
                    />
                </SettingCard>

                {/* ② 本地增强资源包：可选的本地大模型，文案强调“在资源包基础上再提升” */}
                <SettingCard
                    title={t('resources.enhance.title')}
                    description={t('resources.enhance.description')}
                    icon={Sparkles}
                    headerAction={renderCapabilityIcons([
                        { cap: CAPABILITY_TRANSLATION, active: subtitleEngine === 'local' },
                        { cap: CAPABILITY_DICTIONARY, active: dictionaryEngine === 'local' },
                    ])}
                >
                    <LocalLlmCard
                        status={localAiStatus}
                        busy={localAiBusy}
                        testingModelId={testingModelId}
                        hardwareHint={enhanceHardwareHint}
                        deleteLabel={t('resources.enhance.delete')}
                        deleteConfirmTitle={t('resources.enhance.deleteConfirmTitle')}
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
                                    void refreshResourceStatus();
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

                {/* ③ 云端服务：可选的云端模型与密钥 */}
                <SettingCard
                    title={t('resources.cloud.title')}
                    description={t('resources.cloud.description')}
                    icon={Cloud}
                    headerAction={renderCapabilityIcons([
                        { cap: CAPABILITY_TRANSLATION, active: subtitleEngine === 'openai' },
                        { cap: CAPABILITY_DICTIONARY, active: dictionaryEngine === 'openai' },
                        { cap: CAPABILITY_SENTENCE, active: sentenceLearningEnabled },
                    ], true)}
                >
                    <OpenAiCredentialCard
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

                {/* ④ 翻译与查词偏好 */}
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
                                    {renderCloudModels('subtitle')}
                                    {/* 存储里指向的云端模型已不在可用列表时补一个禁用项，避免下拉显示为空 */}
                                    {subtitleEngine === 'openai'
                                        && !!watched.openai?.featureModels?.subtitleTranslation
                                        && !availableModels.includes(watched.openai.featureModels.subtitleTranslation) && (
                                        <SelectItem value={`openai:${watched.openai.featureModels.subtitleTranslation}`} disabled>
                                            {watched.openai.featureModels.subtitleTranslation}
                                        </SelectItem>
                                    )}
                                    <SelectItem value="local-mt">{t('resources.preference.engineLocalBase')}</SelectItem>
                                    <SelectItem value="local">{t('resources.preference.engineLocalAi')}</SelectItem>
                                    <SelectItem value="none">{t('resources.preference.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {subtitleEngine === 'local' && !(localAiStatus?.models.some((model) => model.ready) ?? false) && (
                                <div className="text-xs text-destructive">{t('resources.preference.notReadyHint')}</div>
                            )}
                        </div>
                    </SettingRow>

                    {/* 翻译风格：下拉与其它行一样靠右，自定义提示词单独占满整行 */}
                    <div className="space-y-3 p-4 transition-colors hover:bg-muted/10">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span>{t('resources.preference.styleLabel')}</span>
                            </div>
                            {subtitleEngine === 'local-mt' ? (
                                <div className="text-xs text-muted-foreground">{t('resources.preference.localMtZhOnlyHint')}</div>
                            ) : (
                                <Select
                                    value={watched.openai?.subtitleTranslationMode}
                                    onValueChange={(value: 'zh' | 'simple_en' | 'custom') => {
                                        setValue('openai.subtitleTranslationMode', value, { shouldDirty: true });
                                    }}
                                >
                                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zh">{t('resources.preference.styleZh')}</SelectItem>
                                        <SelectItem value="simple_en">{t('resources.preference.styleSimpleEn')}</SelectItem>
                                        <SelectItem value="custom">{t('resources.preference.styleCustom')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        {subtitleEngine !== 'local-mt' && (
                            <Textarea
                                value={subtitleMode === 'custom'
                                    ? watched.openai?.subtitleCustomStyle
                                    : OPENAI_SUBTITLE_DEFAULT_STYLES[subtitleMode === 'simple_en' ? 'simple_en' : 'zh']}
                                onChange={(event) => {
                                    setValue('openai.subtitleCustomStyle', event.target.value, { shouldDirty: true });
                                }}
                                readOnly={subtitleMode !== 'custom'}
                                placeholder={t('resources.preference.stylePlaceholder')}
                                className={cn(
                                    'min-h-[100px] w-full resize-none text-xs',
                                    subtitleMode !== 'custom' && 'cursor-default bg-muted/40 text-muted-foreground',
                                )}
                            />
                        )}
                    </div>

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
                                    {renderCloudModels('dictionary')}
                                    {/* 存储里指向的云端模型已不在可用列表时补一个禁用项，避免下拉显示为空 */}
                                    {watched.providers?.dictionaryEngine === 'openai'
                                        && !!watched.openai?.featureModels?.dictionary
                                        && !availableModels.includes(watched.openai.featureModels.dictionary) && (
                                        <SelectItem value={`openai:${watched.openai.featureModels.dictionary}`} disabled>
                                            {watched.openai.featureModels.dictionary}
                                        </SelectItem>
                                    )}
                                    <SelectItem value="local">{t('resources.preference.engineLocalAi')}</SelectItem>
                                    <SelectItem value="none">{t('resources.preference.engineNoSupplement')}</SelectItem>
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

                    {(cacheTargets.subtitle || cacheTargets.dictionary) && (
                        <SettingRow
                            title={t('resources.preference.cacheLabel')}
                            description={t('resources.preference.cacheDesc')}
                            icon={Eraser}
                        >
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={clearingCache}
                                onClick={() => { void clearCaches(); }}
                            >
                                {clearingCache
                                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    : <Eraser className="mr-1.5 h-3.5 w-3.5" />}
                                {t('resources.preference.clearCache')}
                            </Button>
                        </SettingRow>
                    )}
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceResourceSetting;
