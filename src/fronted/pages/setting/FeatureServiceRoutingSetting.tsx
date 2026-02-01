import React from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';

import SettingsPage from '@/fronted/pages/setting/components/SettingsPage';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Textarea } from '@/fronted/components/ui/textarea';
import { Button } from '@/fronted/components/ui/button';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useToast } from '@/fronted/components/ui/use-toast';
import { getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';
import { FeatureServiceRoutingVO } from '@/common/types/vo/feature-service-routing-vo';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';

const api = backendClient;

export default function FeatureServiceRoutingSetting() {
    const logger = getRendererLogger('FeatureServiceRoutingSetting');
    const { toast } = useToast();

    const { data: features, mutate } = useSWR('settings/features/get', () => api.call('settings/features/get'));
    const { data: credentials } = useSWR('settings/credentials/get', () => api.call('settings/credentials/get'));
    const { data: whisperModelStatus } = useSWR('whisper/models/status', () => api.call('whisper/models/status'));

    const { register, handleSubmit, watch, setValue, reset } = useForm<FeatureServiceRoutingVO>();

    register('subtitleTranslation.openai.mode');
    register('subtitleTranslation.openai.customStyle');

    const [originalValues, setOriginalValues] = React.useState<FeatureServiceRoutingVO | null>(null);
    const currentValues = watch();

    const hasChanges = React.useMemo(() => {
        if (!originalValues) return false;
        return JSON.stringify(currentValues) !== JSON.stringify(originalValues);
    }, [currentValues, originalValues]);

    const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSavePromiseRef = React.useRef<Promise<void> | null>(null);
    const hasChangesRef = React.useRef(false);
    const isMountedRef = React.useRef(true);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        hasChangesRef.current = hasChanges;
    }, [hasChanges]);

    React.useEffect(() => {
        if (!features) return;
        const data: FeatureServiceRoutingVO = {
            subtitleTranslation: {
                provider: features.subtitleTranslation.provider ?? 'disabled',
                openai: {
                    mode: features.subtitleTranslation.openai?.mode ?? 'zh',
                    customStyle: features.subtitleTranslation.openai?.customStyle ?? '',
                },
            },
            dictionary: { provider: features.dictionary.provider ?? 'disabled' },
            transcription: { provider: features.transcription.provider ?? 'disabled' },
            sentenceLearning: { enabled: features.sentenceLearning.enabled ?? false },
        };
        reset(data, { keepDefaultValues: false });
        setOriginalValues(data);
    }, [features, reset]);

    const saveFeatures = React.useCallback(async (values: FeatureServiceRoutingVO) => {
        await api.call('settings/features/update', { patch: values });
        await mutate();
        setOriginalValues(values);
    }, [mutate]);

    const runSave = React.useCallback((values: FeatureServiceRoutingVO) => {
        const promise = (async () => {
            try {
                await saveFeatures(values);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                toast({
                    variant: 'destructive',
                    title: '保存失败',
                    description: message,
                });
                throw error;
            }
        })();

        pendingSavePromiseRef.current = promise;
        promise.finally(() => {
            if (pendingSavePromiseRef.current === promise) {
                pendingSavePromiseRef.current = null;
            }
        });
        return promise;
    }, [saveFeatures, toast]);

    const flushPendingSave = React.useCallback(async () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        if (pendingSavePromiseRef.current) {
            await pendingSavePromiseRef.current;
        }
        if (!originalValues || !hasChangesRef.current) {
            return;
        }
        await handleSubmit(runSave)();
        if (pendingSavePromiseRef.current) {
            await pendingSavePromiseRef.current;
        }
    }, [handleSubmit, runSave, originalValues]);

    React.useEffect(() => {
        if (!originalValues || !hasChanges) {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
            return;
        }
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            handleSubmit(runSave)().catch((error) => {
                logger.error('auto save failed', { error });
            });
        }, 700);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [handleSubmit, hasChanges, originalValues, runSave, logger, currentValues]);

    const subtitleProvider = watch('subtitleTranslation.provider');
    const subtitleMode = watch('subtitleTranslation.openai.mode');
    const subtitleCustomStyle = watch('subtitleTranslation.openai.customStyle');

    const dictionaryProvider = watch('dictionary.provider');
    const transcriptionProvider = watch('transcription.provider');
    const sentenceLearningEnabled = watch('sentenceLearning.enabled');

    const openAiReady = !!credentials?.openai?.apiKey && !!credentials?.openai?.endpoint;
    const tencentReady = !!credentials?.tencent?.secretId && !!credentials?.tencent?.secretKey;
    const youdaoReady = !!credentials?.youdao?.secretId && !!credentials?.youdao?.secretKey;

    const whisperSize = credentials?.local?.whisper?.modelSize === 'large' ? 'large' : 'base';
    const whisperReady = whisperSize === 'large'
        ? !!(whisperModelStatus as WhisperModelStatusVO | undefined)?.whisper?.large?.exists
        : !!(whisperModelStatus as WhisperModelStatusVO | undefined)?.whisper?.base?.exists;

    const subtitleModePreview = React.useMemo(() => {
        if (subtitleMode !== 'custom') return '';
        return subtitleCustomStyle?.trim()?.length ? subtitleCustomStyle : getSubtitleDefaultStyle('custom');
    }, [subtitleMode, subtitleCustomStyle]);

    const maybeShowCredentialHint = (hint: string) => {
        return (
            <div className="text-sm text-muted-foreground">
                {hint}{' '}
                <Link to="/settings/credentials" className="underline">
                    去配置
                </Link>
            </div>
        );
    };

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit(runSave)().catch((error) => logger.error('manual submit failed', { error }));
            }}
            className="w-full h-full min-h-0 flex flex-col"
        >
            <SettingsPage
                title="功能服务"
                description="为每个功能选择使用哪个服务（可禁用）"
            >
                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>字幕翻译</CardTitle>
                            <CardDescription>选择字幕翻译使用的服务与 OpenAI 模式</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label>服务</Label>
                                <Select
                                    value={subtitleProvider}
                                    onValueChange={(value) => setValue('subtitleTranslation.provider', value as FeatureServiceRoutingVO['subtitleTranslation']['provider'])}
                                >
                                    <SelectTrigger className="w-72">
                                        <SelectValue placeholder="选择服务" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="disabled">禁用</SelectItem>
                                        <SelectItem value="openai">OpenAI</SelectItem>
                                        <SelectItem value="tencent">腾讯翻译</SelectItem>
                                    </SelectContent>
                                </Select>
                                {subtitleProvider === 'openai' && !openAiReady ? maybeShowCredentialHint('OpenAI 未配置完整密钥/Endpoint。') : null}
                                {subtitleProvider === 'tencent' && !tencentReady ? maybeShowCredentialHint('腾讯翻译未配置完整密钥。') : null}
                            </div>

                            {subtitleProvider === 'openai' ? (
                                <>
                                    <div className="grid gap-2">
                                        <Label>OpenAI 字幕模式</Label>
                                        <Select
                                            value={subtitleMode}
                                            onValueChange={(value) => setValue('subtitleTranslation.openai.mode', value as FeatureServiceRoutingVO['subtitleTranslation']['openai']['mode'])}
                                        >
                                            <SelectTrigger className="w-72">
                                                <SelectValue placeholder="选择模式" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="zh">中文</SelectItem>
                                                <SelectItem value="simple_en">简英</SelectItem>
                                                <SelectItem value="custom">自定义</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {subtitleMode === 'custom' ? (
                                        <div className="grid gap-2">
                                            <Label>自定义风格（留空使用默认）</Label>
                                            <Textarea
                                                value={subtitleCustomStyle ?? ''}
                                                onChange={(e) => setValue('subtitleTranslation.openai.customStyle', e.target.value)}
                                                placeholder={getSubtitleDefaultStyle('custom')}
                                                className="min-h-[140px]"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => setValue('subtitleTranslation.openai.customStyle', '')}
                                                >
                                                    恢复默认风格
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={async () => {
                                                        try {
                                                            await flushPendingSave();
                                                            toast({
                                                                title: '已保存',
                                                                description: '自定义风格将用于后续翻译',
                                                            });
                                                        } catch {
                                                            // ignore
                                                        }
                                                    }}
                                                >
                                                    立即保存
                                                </Button>
                                            </div>
                                            {subtitleModePreview ? (
                                                <div className="rounded-md border p-3 text-sm whitespace-pre-wrap">
                                                    {subtitleModePreview}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>查词</CardTitle>
                            <CardDescription>鼠标悬浮单词时使用的词典服务</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <Label>服务</Label>
                            <Select
                                value={dictionaryProvider}
                                onValueChange={(value) => setValue('dictionary.provider', value as FeatureServiceRoutingVO['dictionary']['provider'])}
                            >
                                <SelectTrigger className="w-72">
                                    <SelectValue placeholder="选择服务" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="disabled">禁用</SelectItem>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="youdao">有道</SelectItem>
                                </SelectContent>
                            </Select>
                            {dictionaryProvider === 'openai' && !openAiReady ? maybeShowCredentialHint('OpenAI 未配置完整密钥/Endpoint。') : null}
                            {dictionaryProvider === 'youdao' && !youdaoReady ? maybeShowCredentialHint('有道未配置完整密钥。') : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>转录</CardTitle>
                            <CardDescription>将视频转为字幕（云端 OpenAI 或本地 Whisper）</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                            <Label>服务</Label>
                            <Select
                                value={transcriptionProvider}
                                onValueChange={(value) => setValue('transcription.provider', value as FeatureServiceRoutingVO['transcription']['provider'])}
                            >
                                <SelectTrigger className="w-72">
                                    <SelectValue placeholder="选择服务" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="disabled">禁用</SelectItem>
                                    <SelectItem value="openai">OpenAI</SelectItem>
                                    <SelectItem value="whisper">Whisper (本地)</SelectItem>
                                </SelectContent>
                            </Select>
                            {transcriptionProvider === 'openai' && !openAiReady ? maybeShowCredentialHint('OpenAI 未配置完整密钥/Endpoint。') : null}
                            {transcriptionProvider === 'whisper' && !whisperReady ? maybeShowCredentialHint(`本地 Whisper 模型未下载（${whisperSize}）。`) : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>句子学习</CardTitle>
                            <CardDescription>需要 OpenAI（可禁用）</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={!!sentenceLearningEnabled}
                                    onCheckedChange={(checked) => setValue('sentenceLearning.enabled', !!checked)}
                                />
                                <span className="text-sm">启用</span>
                            </div>
                            {sentenceLearningEnabled && !openAiReady ? maybeShowCredentialHint('OpenAI 未配置完整密钥/Endpoint。') : null}
                        </CardContent>
                    </Card>
                </div>
            </SettingsPage>
        </form>
    );
}
