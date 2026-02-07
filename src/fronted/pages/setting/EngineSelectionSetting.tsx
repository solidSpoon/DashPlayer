import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Book, Languages, Mic, Settings2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/fronted/components/ui/button';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Textarea } from '@/fronted/components/ui/textarea';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ServiceCredentialSettingVO } from '@/common/types/vo/service-credentials-setting-vo';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useToast } from '@/fronted/components/ui/use-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const api = backendClient;

const EngineSelectionSetting = () => {
    const { t } = useI18nTranslation('settings');
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: settings, mutate } = useSWR('settings/engine-selection/get', () =>
        api.call('settings/engine-selection/get'),
    );
    const { data: credentialSettings } = useSWR<ServiceCredentialSettingVO>(
        'settings/service-credentials/get',
        () => api.call('settings/service-credentials/get'),
    );
    const { data: whisperStatus } = useSWR<WhisperModelStatusVO>(
        'whisper/models/status',
        () => api.call('whisper/models/status'),
    );

    const { register, setValue, watch, reset, handleSubmit } = useForm<EngineSelectionSettingVO>({
        defaultValues: {
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: getSubtitleDefaultStyle('custom'),
                featureModels: {
                    sentenceLearning: 'gpt-4o-mini',
                    subtitleTranslation: 'gpt-4o-mini',
                    dictionary: 'gpt-4o-mini',
                },
            },
            providers: {
                subtitleTranslationEngine: 'openai',
                dictionaryEngine: 'openai',
                transcriptionEngine: 'openai',
            },
        },
    });

    register('openai.enableSentenceLearning');
    register('openai.subtitleTranslationMode');
    register('openai.subtitleCustomStyle');
    register('openai.featureModels.sentenceLearning');
    register('openai.featureModels.subtitleTranslation');
    register('openai.featureModels.dictionary');
    register('providers.subtitleTranslationEngine');
    register('providers.dictionaryEngine');
    register('providers.transcriptionEngine');

    React.useEffect(() => {
        if (settings) {
            reset(settings);
        }
    }, [settings, reset]);

    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const subtitleMode = watch('openai.subtitleTranslationMode');
    const subtitleEngine = watch('providers.subtitleTranslationEngine');
    const transcriptionEngine = watch('providers.transcriptionEngine');
    const availableModels = credentialSettings?.openai.models?.length
        ? credentialSettings.openai.models
        : ['gpt-4o-mini'];

    const whisperSelectedModelSize = credentialSettings?.whisper.modelSize === 'large' ? 'large' : 'base';
    const whisperModelReady = whisperStatus?.whisper?.[whisperSelectedModelSize]?.exists === true;
    const shouldShowWhisperConfigHint = transcriptionEngine === 'whisper' && !whisperModelReady;

    const onSave = handleSubmit(async (data) => {
        try {
            await api.call('settings/engine-selection/update', data);
            await mutate();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('common.saveFailed'),
                description: error instanceof Error ? error.message : String(error),
            });
        }
    });

    React.useEffect(() => {
        const subscription = watch(() => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                onSave().catch(() => null);
            }, 500);
        });

        return () => {
            subscription.unsubscribe();
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [watch, onSave]);

    return (
        <form className="w-full h-full min-h-0" onSubmit={(event) => {
            event.preventDefault();
            onSave().catch(() => null);
        }}>
            <SettingsPageShell
                title={t('engineSelection.title')}
                description={t('engineSelection.description')}
                contentClassName="space-y-6"
            >
                <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    {t('engineSelection.intro')}
                </div>

                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Settings2 className="w-5 h-5" />
                    {t('engineSelection.featureSwitches')}
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Languages className="w-4 h-4" />{t('engineSelection.subtitleTranslation.title')}</div>
                            <div className="text-xs text-muted-foreground">{t('engineSelection.subtitleTranslation.description')}</div>
                        </div>
                        <div className="w-full md:w-64">
                            <Select
                                value={watch('providers.subtitleTranslationEngine')}
                                onValueChange={(value: 'openai' | 'tencent' | 'none') => {
                                    setValue('providers.subtitleTranslationEngine', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="tencent">{t('engineSelection.engineTencent')}</SelectItem>
                                    <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pl-0 md:pl-6 border-l-0 md:border-l md:border-border space-y-3">
                        {subtitleEngine === 'openai' ? (
                            <>
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">{t('engineSelection.subtitleTranslation.modelLabel')}</div>
                                    <Select
                                        value={watch('openai.featureModels.subtitleTranslation')}
                                        onValueChange={(value) => {
                                            setValue('openai.featureModels.subtitleTranslation', value, { shouldDirty: true });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {availableModels.map((model) => (
                                                <SelectItem key={`subtitle-${model}`} value={model}>{model}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="text-xs font-medium text-muted-foreground">{t('engineSelection.subtitleTranslation.styleLabel')}</div>
                                <Select
                                    value={watch('openai.subtitleTranslationMode')}
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
                                        value={watch('openai.subtitleCustomStyle')}
                                        onChange={(event) => {
                                            setValue('openai.subtitleCustomStyle', event.target.value, { shouldDirty: true });
                                        }}
                                        className="min-h-[150px]"
                                    />
                                )}
                            </>
                        ) : (
                            <div className="text-xs text-muted-foreground">{t('engineSelection.subtitleTranslation.hiddenHint')}</div>
                        )}
                    </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Book className="w-4 h-4" />{t('engineSelection.dictionary.title')}</div>
                            <div className="text-xs text-muted-foreground">{t('engineSelection.dictionary.description')}</div>
                        </div>
                        <div className="w-full md:w-64">
                            <Select
                                value={watch('providers.dictionaryEngine')}
                                onValueChange={(value: 'openai' | 'youdao' | 'none') => {
                                    setValue('providers.dictionaryEngine', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="youdao">{t('engineSelection.engineYoudao')}</SelectItem>
                                    <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {watch('providers.dictionaryEngine') === 'openai' && (
                        <div className="space-y-2 md:pl-6 md:border-l md:border-border">
                            <div className="text-xs font-medium text-muted-foreground">{t('engineSelection.dictionary.modelLabel')}</div>
                            <Select
                                value={watch('openai.featureModels.dictionary')}
                                onValueChange={(value) => {
                                    setValue('openai.featureModels.dictionary', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((model) => (
                                        <SelectItem key={`dict-${model}`} value={model}>{model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Mic className="w-4 h-4" />{t('engineSelection.transcription.title')}</div>
                            <div className="text-xs text-muted-foreground">{t('engineSelection.transcription.description')}</div>
                        </div>
                        <div className="w-full md:w-64">
                            <Select
                                value={watch('providers.transcriptionEngine')}
                                onValueChange={(value: 'openai' | 'whisper' | 'none') => {
                                    setValue('providers.transcriptionEngine', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="whisper">{t('engineSelection.engineWhisperLocal')}</SelectItem>
                                    <SelectItem value="none">{t('engineSelection.engineNone')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {shouldShowWhisperConfigHint && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            {t('engineSelection.transcription.whisperHint')}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="ml-3"
                                onClick={() => navigate('/settings/service-credentials')}
                            >
                                {t('engineSelection.transcription.goConfigure')}
                            </Button>
                        </div>
                    )}

                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-background p-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" />{t('engineSelection.sentenceLearning.title')}</div>
                        <div className="text-xs text-muted-foreground">{t('engineSelection.sentenceLearning.description')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={watch('openai.enableSentenceLearning')}
                            onCheckedChange={(checked) => setValue('openai.enableSentenceLearning', checked === true, { shouldDirty: true })}
                        />
                        <Label>{t('engineSelection.sentenceLearning.enable')}</Label>
                    </div>

                    {watch('openai.enableSentenceLearning') && (
                        <div className="space-y-2 md:pl-6 md:border-l md:border-border">
                            <div className="text-xs font-medium text-muted-foreground">{t('engineSelection.sentenceLearning.modelLabel')}</div>
                            <Select
                                value={watch('openai.featureModels.sentenceLearning')}
                                onValueChange={(value) => {
                                    setValue('openai.featureModels.sentenceLearning', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((model) => (
                                        <SelectItem key={`learn-${model}`} value={model}>{model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </SettingsPageShell>

        </form>
    );
};

export default EngineSelectionSetting;
