import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import { Book, Eraser, Languages, Settings2, Sparkles } from 'lucide-react';
import { Label } from '@/fronted/components/ui/label';
import { Button } from '@/fronted/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/fronted/components/ui/alert-dialog';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Textarea } from '@/fronted/components/ui/textarea';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingRow, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';

/**
 * 功能设置页。
 */
const EngineSelectionSetting = () => {
    const { t } = useI18nTranslation('settings');

    const { data: settings } = useSWR('settings/engine-selection/detail', () =>
        settingsApi.getEngineSelection(),
    );
    const { data: credentialSettings } = useSWR<ServiceCredentialSettingDetailVO>(
        'settings/service-credentials/detail',
        settingsApi.getServiceCredentials,
    );
    const { data: localAiStatus } = useSWR(
        'local-ai/status',
        settingsApi.getLocalAiStatus,
    );

    const form = useForm<EngineSelectionSettingVO>();
    const { setValue } = form;
    const [subtitleMode, subtitleEngine] = useWatch({
        control: form.control,
        name: ['openai.subtitleTranslationMode', 'providers.subtitleTranslationEngine'],
    });
    const watchedValues = useWatch({ control: form.control });

    const {
        ready,
        status: autoSaveStatus,
        error: autoSaveError,
        initialize,
        flush,
    } = useAutoSaveSettingsForm<EngineSelectionSettingVO>({
        form,
        onSave: async (values) => {
            await settingsApi.saveEngineSelection(values);
        },
    });

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize(settings);
    }, [initialize, settings]);

    const availableModels = React.useMemo(() => {
        if (!credentialSettings) {
            return [];
        }
        return credentialSettings.openai.models.map((item) => item.model);
    }, [credentialSettings]);

    /**
     * 将当前引擎与模型选择组合成下拉列表项的值；纯引擎选项直接返回枚举值。
     *
     * @param engine 当前引擎。
     * @param model 当前选中的 OpenAI 模型 id（仅云端引擎有意义）。
     * @returns 下拉项值，形如 `openai:<model>` / `local` / `tencent` / `none`。
     */
    const composeOptionValue = (engine: string | undefined, model: string | undefined): string | undefined => {
        if (!engine) {
            return undefined;
        }
        if (engine === 'openai') {
            return `openai:${model ?? ''}`;
        }
        return engine;
    };

    /**
     * 解析下拉项值并写回引擎与模型两个字段；本地引擎共用凭据页指定的模型，不在此选模型。
     *
     * @param value 下拉项值。
     * @param engineKey 引擎字段名。
     * @param modelField OpenAI 模型字段名。
     */
    const applyOptionValue = (
        value: string,
        engineKey: 'providers.subtitleTranslationEngine' | 'providers.dictionaryEngine',
        modelField: 'openai.featureModels.subtitleTranslation' | 'openai.featureModels.dictionary',
    ): void => {
        const separator = value.indexOf(':');
        const engine = separator === -1 ? value : value.slice(0, separator);
        const model = separator === -1 ? '' : value.slice(separator + 1);
        setValue(engineKey, engine as 'openai' | 'local' | 'tencent' | 'youdao' | 'none', { shouldDirty: true });
        if (engine === 'openai') {
            setValue(modelField, model, { shouldDirty: true });
        }
    };

    /** 是否有任意一个本地模型已下载完成。 */
    const anyLocalModelReady = localAiStatus?.models.some((model) => model.ready) ?? false;

    const [cacheClearing, setCacheClearing] = React.useState<'subtitle' | 'dictionary' | null>(null);

    /**
     * 清除当前配置的字幕翻译或词典缓存，并在提示中展示删除条数。
     *
     * 后端按已保存配置精确匹配缓存键，只删当前引擎、模型与风格对应的记录。
     *
     * @param target 清除目标（字幕翻译或词典）。
     */
    const clearCache = async (target: 'subtitle' | 'dictionary') => {
        setCacheClearing(target);
        try {
            const { deleted } = target === 'subtitle'
                ? await settingsApi.clearSubtitleTranslationCache()
                : await settingsApi.clearDictionaryCache();
            toast.success(t('engineSelection.clearCacheSuccess', { count: deleted }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            setCacheClearing(null);
        }
    };

    /**
     * 渲染带确认弹窗的“清除缓存”按钮；清除范围由文案说明。
     *
     * @param target 清除目标（字幕翻译或词典）。
     */
    const renderClearCacheButton = (target: 'subtitle' | 'dictionary') => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={cacheClearing !== null}>
                    <Eraser className="mr-1.5 h-3.5 w-3.5" />
                    {t('engineSelection.clearCache')}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t(`engineSelection.${target === 'subtitle' ? 'subtitleTranslation' : 'dictionary'}.clearCacheConfirmTitle`)}</AlertDialogTitle>
                    <AlertDialogDescription>{t(`engineSelection.${target === 'subtitle' ? 'subtitleTranslation' : 'dictionary'}.clearCacheConfirmDescription`)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('engineSelection.clearCacheCancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clearCache(target).catch(() => null)}>
                        {t('engineSelection.clearCache')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );


    if (!ready || !credentialSettings) {
        return (
            <SettingsLoadingSkeleton
                title={t('engineSelection.title')}
                description={t('engineSelection.description')}
            />
        );
    }

    return (
        <form className="w-full h-full min-h-0" onSubmit={(event) => {
            event.preventDefault();
            flush().catch(() => null);
        }}>
            <SettingsPageShell
                title={t('engineSelection.title')}
                description={t('engineSelection.description')}
                contentClassName="space-y-6"
            >
                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}

                {/* 字幕翻译引擎 */}
                <SettingCard
                    title={t('engineSelection.subtitleTranslation.title')}
                    description={t('engineSelection.subtitleTranslation.description')}
                    icon={Languages}
                >
                    <SettingRow
                        title={t('engineSelection.subtitleTranslation.title')}
                        description={t('engineSelection.subtitleTranslation.description')}
                        icon={Languages}
                    >
                        <div className="flex flex-col gap-1.5">
                            <Select
                                value={composeOptionValue(
                                    watchedValues.providers?.subtitleTranslationEngine,
                                    watchedValues.openai?.featureModels?.subtitleTranslation,
                                )}
                                onValueChange={(value) =>
                                    applyOptionValue(
                                        value,
                                        'providers.subtitleTranslationEngine',
                                        'openai.featureModels.subtitleTranslation',
                                    )
                                }
                            >
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="tencent">{t('engineSelection.engineTencent')}</SelectItem>
                                    <SelectGroup>
                                        <SelectLabel>{t('engineSelection.cloudModelGroup')}</SelectLabel>
                                        {availableModels.map((model) => (
                                            <SelectItem key={`subtitle-${model}`} value={`openai:${model}`}>{model}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectItem value="local">{t('engineSelection.localEngine')}</SelectItem>
                                    <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {subtitleEngine === 'local' && !anyLocalModelReady && (
                                <div className="text-xs text-destructive">{t('engineSelection.notDownloadedHint')}</div>
                            )}
                            {subtitleEngine !== 'none' && renderClearCacheButton('subtitle')}
                        </div>
                    </SettingRow>

                    {(subtitleEngine === 'openai' || subtitleEngine === 'local') && (
                        <SettingRow
                                title={t('engineSelection.subtitleTranslation.styleLabel')}
                                icon={Settings2}
                                alignTop={subtitleMode === 'custom'}
                            >
                                <div className="flex flex-col gap-2 w-72">
                                    <Select
                                        value={watchedValues.openai?.subtitleTranslationMode}
                                        onValueChange={(value: 'zh' | 'simple_en' | 'custom') => {
                                            setValue('openai.subtitleTranslationMode', value, { shouldDirty: true });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="zh">{t('engineSelection.subtitleTranslation.styleZh')}</SelectItem>
                                            <SelectItem value="simple_en">{t('engineSelection.subtitleTranslation.styleSimpleEn')}</SelectItem>
                                            <SelectItem value="custom">{t('engineSelection.subtitleTranslation.styleCustom')}</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {subtitleMode === 'custom' && (
                                        <Textarea
                                            value={watchedValues.openai?.subtitleCustomStyle}
                                            onChange={(event) => {
                                                setValue('openai.subtitleCustomStyle', event.target.value, { shouldDirty: true });
                                            }}
                                            placeholder="自定义 Prompt 样式..."
                                            className="min-h-[100px] text-xs resize-none"
                                        />
                                    )}
                                </div>
                            </SettingRow>
                    )}
                </SettingCard>

                {/* 词典引擎 */}
                <SettingCard
                    title={t('engineSelection.dictionary.title')}
                    description={t('engineSelection.dictionary.description')}
                    icon={Book}
                >
                    <SettingRow
                        title={t('engineSelection.dictionary.title')}
                        description={t('engineSelection.dictionary.description')}
                        icon={Book}
                    >
                        <div className="flex flex-col gap-1.5">
                            <Select
                                value={composeOptionValue(
                                    watchedValues.providers?.dictionaryEngine,
                                    watchedValues.openai?.featureModels?.dictionary,
                                )}
                                onValueChange={(value) =>
                                    applyOptionValue(
                                        value,
                                        'providers.dictionaryEngine',
                                        'openai.featureModels.dictionary',
                                    )
                                }
                            >
                                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="youdao">{t('engineSelection.engineYoudao')}</SelectItem>
                                    <SelectGroup>
                                        <SelectLabel>{t('engineSelection.cloudModelGroup')}</SelectLabel>
                                        {availableModels.map((model) => (
                                            <SelectItem key={`dict-${model}`} value={`openai:${model}`}>{model}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                    <SelectItem value="local">{t('engineSelection.localEngine')}</SelectItem>
                                    <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {watchedValues.providers?.dictionaryEngine === 'local' && !anyLocalModelReady && (
                                <div className="text-xs text-destructive">{t('engineSelection.notDownloadedHint')}</div>
                            )}
                            {watchedValues.providers?.dictionaryEngine !== 'none' && renderClearCacheButton('dictionary')}
                        </div>
                    </SettingRow>
                </SettingCard>

                {/* 句法分析与例句学习 */}
                <SettingCard
                    title={t('engineSelection.sentenceLearning.title')}
                    description={t('engineSelection.sentenceLearning.description')}
                    icon={Sparkles}
                >
                    <SettingRow
                        title={t('engineSelection.sentenceLearning.enable')}
                        description={t('engineSelection.sentenceLearning.description')}
                        icon={Sparkles}
                    >
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="enable-sentence-learning"
                                checked={watchedValues.openai?.enableSentenceLearning}
                                onCheckedChange={(checked) => setValue('openai.enableSentenceLearning', checked === true, { shouldDirty: true })}
                            />
                            <Label htmlFor="enable-sentence-learning" className="cursor-pointer text-xs">
                                {t('engineSelection.sentenceLearning.enable')}
                            </Label>
                        </div>
                    </SettingRow>

                    {watchedValues.openai?.enableSentenceLearning && (
                        <SettingRow
                            title={t('engineSelection.sentenceLearning.modelLabel')}
                            icon={Settings2}
                        >
                            <Select
                                value={watchedValues.openai?.featureModels?.sentenceLearning}
                                onValueChange={(value) => {
                                    setValue('openai.featureModels.sentenceLearning', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((model) => (
                                        <SelectItem key={`learn-${model}`} value={model}>{model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    )}
                </SettingCard>
            </SettingsPageShell>
        </form>
    );
};

export default EngineSelectionSetting;
