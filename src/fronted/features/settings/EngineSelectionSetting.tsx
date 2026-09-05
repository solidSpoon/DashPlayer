import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import useSWR from 'swr';
import { Book, Languages, Settings2, Sparkles } from 'lucide-react';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
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
                        <Select
                            value={watchedValues.providers?.subtitleTranslationEngine}
                            onValueChange={(value: 'openai' | 'local' | 'tencent' | 'none') => {
                                setValue('providers.subtitleTranslationEngine', value, { shouldDirty: true });
                            }}
                        >
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="local">本地 Qwen 1.7B</SelectItem>
                                <SelectItem value="tencent">{t('engineSelection.engineTencent')}</SelectItem>
                                <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {(subtitleEngine === 'openai' || subtitleEngine === 'local') && (
                        <>
                            <SettingRow
                                title={t('engineSelection.subtitleTranslation.modelLabel')}
                                icon={Settings2}
                            >
                                <Select
                                    value={watchedValues.openai?.featureModels?.subtitleTranslation}
                                    onValueChange={(value) => {
                                        setValue('openai.featureModels.subtitleTranslation', value, { shouldDirty: true });
                                    }}
                                >
                                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {availableModels.map((model) => (
                                            <SelectItem key={`subtitle-${model}`} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingRow>

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
                        </>
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
                        <Select
                            value={watchedValues.providers?.dictionaryEngine}
                            onValueChange={(value: 'openai' | 'local' | 'youdao' | 'none') => {
                                setValue('providers.dictionaryEngine', value, { shouldDirty: true });
                            }}
                        >
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="local">本地 Qwen 1.7B</SelectItem>
                                <SelectItem value="youdao">{t('engineSelection.engineYoudao')}</SelectItem>
                                <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </SettingRow>

                    {watchedValues.providers?.dictionaryEngine === 'openai' && (
                        <SettingRow
                            title={t('engineSelection.dictionary.modelLabel')}
                            icon={Settings2}
                        >
                            <Select
                                value={watchedValues.openai?.featureModels?.dictionary}
                                onValueChange={(value) => {
                                    setValue('openai.featureModels.dictionary', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((model) => (
                                        <SelectItem key={`dict-${model}`} value={model}>{model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    )}
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
