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
import Header from '@/fronted/pages/setting/components/form/Header';
import { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import { ServiceCredentialSettingVO } from '@/common/types/vo/service-credentials-setting-vo';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useToast } from '@/fronted/components/ui/use-toast';

const api = backendClient;

const EngineSelectionSetting = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { data: settings, mutate, isLoading } = useSWR('settings/engine-selection/get', () =>
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
                    transcription: 'gpt-4o-mini',
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
    register('openai.featureModels.transcription');
    register('providers.subtitleTranslationEngine');
    register('providers.dictionaryEngine');
    register('providers.transcriptionEngine');

    React.useEffect(() => {
        if (settings) {
            reset(settings);
        }
    }, [settings, reset]);

    const [saving, setSaving] = React.useState(false);
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
        setSaving(true);
        try {
            await api.call('settings/engine-selection/update', data);
            await mutate();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: '保存失败',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setSaving(false);
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
        <form className="w-full h-full flex flex-col gap-6" onSubmit={(event) => {
            event.preventDefault();
            onSave().catch(() => null);
        }}>
            <Header title="功能设置" description="按功能选择服务来源，可独立关闭" />

            <div className="flex flex-col gap-6 h-0 flex-1 overflow-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-gray-300">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    不同功能可以独立选择服务来源。选择“关闭”后，该功能在播放器侧将不再执行。
                </div>

                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Settings2 className="w-5 h-5" />
                    功能开关
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Languages className="w-4 h-4" />字幕翻译</div>
                            <div className="text-xs text-muted-foreground">控制字幕翻译服务来源</div>
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
                                    <SelectItem value="tencent">腾讯翻译</SelectItem>
                                    <SelectItem value="none">关闭</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="pl-0 md:pl-6 border-l-0 md:border-l md:border-border space-y-3">
                        {subtitleEngine === 'openai' ? (
                            <>
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">字幕翻译模型</div>
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

                                <div className="text-xs font-medium text-muted-foreground">OpenAI 字幕输出风格</div>
                                <Select
                                    value={watch('openai.subtitleTranslationMode')}
                                    onValueChange={(value: 'zh' | 'simple_en' | 'custom') => {
                                        setValue('openai.subtitleTranslationMode', value, { shouldDirty: true });
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zh">中文直译</SelectItem>
                                        <SelectItem value="simple_en">简化英文</SelectItem>
                                        <SelectItem value="custom">自定义</SelectItem>
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
                            <div className="text-xs text-muted-foreground">当前未使用 OpenAI 字幕翻译，风格设置已自动隐藏。</div>
                        )}
                    </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold"><Book className="w-4 h-4" />词典查询</div>
                            <div className="text-xs text-muted-foreground">用于单词释义与例句查询</div>
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
                                    <SelectItem value="youdao">有道词典</SelectItem>
                                    <SelectItem value="none">关闭</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {watch('providers.dictionaryEngine') === 'openai' && (
                        <div className="space-y-2 md:pl-6 md:border-l md:border-border">
                            <div className="text-xs font-medium text-muted-foreground">词典查询模型</div>
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
                            <div className="flex items-center gap-2 text-sm font-semibold"><Mic className="w-4 h-4" />字幕转录</div>
                            <div className="text-xs text-muted-foreground">控制语音转字幕所使用的服务</div>
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
                                    <SelectItem value="whisper">Whisper 本地</SelectItem>
                                    <SelectItem value="none">关闭</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {shouldShowWhisperConfigHint && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            本地转录尚未配置完成（模型未下载），请先去“服务凭据”页面下载对应 Whisper 模型。
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="ml-3"
                                onClick={() => navigate('/settings/service-credentials')}
                            >
                                去配置
                            </Button>
                        </div>
                    )}

                    {watch('providers.transcriptionEngine') === 'openai' && (
                        <div className="space-y-2 md:pl-6 md:border-l md:border-border">
                            <div className="text-xs font-medium text-muted-foreground">转录模型</div>
                            <Select
                                value={watch('openai.featureModels.transcription')}
                                onValueChange={(value) => {
                                    setValue('openai.featureModels.transcription', value, { shouldDirty: true });
                                }}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((model) => (
                                        <SelectItem key={`trans-${model}`} value={model}>{model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="space-y-3 rounded-xl border border-border/70 bg-background p-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" />整句学习</div>
                        <div className="text-xs text-muted-foreground">用于句子解析、学习提示等增强功能</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={watch('openai.enableSentenceLearning')}
                            onCheckedChange={(checked) => setValue('openai.enableSentenceLearning', checked === true, { shouldDirty: true })}
                        />
                        <Label>启用 OpenAI 整句学习</Label>
                    </div>

                    {watch('openai.enableSentenceLearning') && (
                        <div className="space-y-2 md:pl-6 md:border-l md:border-border">
                            <div className="text-xs font-medium text-muted-foreground">整句学习模型</div>
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
            </div>

        </form>
    );
};

export default EngineSelectionSetting;
