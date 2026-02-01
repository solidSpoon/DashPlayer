import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';

import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import SettingsPage from '@/fronted/pages/setting/components/SettingsPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/fronted/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Button } from '@/fronted/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Textarea } from '@/fronted/components/ui/textarea';
import { Progress } from '@/fronted/components/ui/progress';
import { useToast } from '@/fronted/components/ui/use-toast';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import useI18n from '@/fronted/i18n/useI18n';

import { ServiceCredentialsVO } from '@/common/types/vo/service-credentials-vo';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';

const api = backendClient;

const OPENAI_MODEL_PRESETS = [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini (推荐)' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
];

export default function ServiceCredentialsSetting() {
    const logger = getRendererLogger('ServiceCredentialsSetting');
    const { toast } = useToast();
    const { t } = useI18n();

    const { data: credentials, mutate } = useSWR('settings/credentials/get', () => api.call('settings/credentials/get'));

    const { register, handleSubmit, watch, setValue, reset } = useForm<ServiceCredentialsVO>();

    register('local.whisper.modelSize');
    register('local.whisper.enableVad');
    register('local.whisper.vadModel');

    const [originalValues, setOriginalValues] = React.useState<ServiceCredentialsVO | null>(null);
    const currentValues = watch();

    const hasChanges = React.useMemo(() => {
        if (!originalValues) return false;
        return JSON.stringify(currentValues) !== JSON.stringify(originalValues);
    }, [currentValues, originalValues]);

    const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSavePromiseRef = React.useRef<Promise<void> | null>(null);
    const hasChangesRef = React.useRef(false);
    const isMountedRef = React.useRef(true);

    // test states/results
    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    const [openAiTestResult, setOpenAiTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
    const [tencentTestResult, setTencentTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
    const [youdaoTestResult, setYoudaoTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

    // whisper model download
    const [whisperModelStatus, setWhisperModelStatus] = React.useState<WhisperModelStatusVO | null>(null);
    const [downloadingWhisperModel, setDownloadingWhisperModel] = React.useState(false);
    const [downloadingVadModel, setDownloadingVadModel] = React.useState(false);
    const [downloadProgressByKey, setDownloadProgressByKey] = React.useState<Record<string, { percent: number; downloaded?: number; total?: number }>>({});

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        hasChangesRef.current = hasChanges;
    }, [hasChanges]);

    React.useEffect(() => {
        if (!credentials) return;

        const data: ServiceCredentialsVO = {
            openai: {
                apiKey: credentials.openai.apiKey || '',
                endpoint: credentials.openai.endpoint || 'https://api.openai.com',
                model: credentials.openai.model || 'gpt-4o-mini',
            },
            tencent: {
                secretId: credentials.tencent.secretId || '',
                secretKey: credentials.tencent.secretKey || '',
            },
            youdao: {
                secretId: credentials.youdao.secretId || '',
                secretKey: credentials.youdao.secretKey || '',
            },
            local: {
                whisper: {
                    modelSize: credentials.local.whisper.modelSize === 'large' ? 'large' : 'base',
                    enableVad: credentials.local.whisper.enableVad ?? true,
                    vadModel: 'silero-v6.2.0',
                },
            },
        };

        reset(data, { keepDefaultValues: false });
        setOriginalValues(data);
    }, [credentials, reset]);

    const saveCredentials = React.useCallback(async (values: ServiceCredentialsVO) => {
        await api.call('settings/credentials/update', { patch: values });
        await mutate();
        setOriginalValues(values);
    }, [mutate]);

    const runSave = React.useCallback((values: ServiceCredentialsVO) => {
        const promise = (async () => {
            try {
                await saveCredentials(values);
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
    }, [saveCredentials, toast]);

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

    const refreshWhisperModelStatus = React.useCallback(async () => {
        try {
            const status = await api.call('whisper/models/status');
            setWhisperModelStatus(status);
        } catch (error) {
            logger.error('failed to fetch whisper model status', { error });
        }
    }, [logger]);

    React.useEffect(() => {
        refreshWhisperModelStatus().catch(() => null);
    }, [refreshWhisperModelStatus]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { key: string; percent: number; downloaded?: number; total?: number } | undefined;
            if (!detail?.key) return;
            setDownloadProgressByKey((prev) => ({
                ...prev,
                [detail.key]: { percent: detail.percent, downloaded: detail.downloaded, total: detail.total },
            }));

            if (detail.percent >= 100) {
                setTimeout(() => {
                    refreshWhisperModelStatus().catch(() => null);
                }, 300);
            }
        };
        window.addEventListener('whisper-model-download-progress', handler as EventListener);
        return () => {
            window.removeEventListener('whisper-model-download-progress', handler as EventListener);
        };
    }, [refreshWhisperModelStatus]);

    const whisperModelSize = watch('local.whisper.modelSize');
    const forcedVadModel = 'silero-v6.2.0' as const;

    const downloadSelectedWhisperModel = async () => {
        const size = (whisperModelSize === 'large' ? 'large' : 'base') as 'base' | 'large';
        const key = `whisper:${size}`;
        setDownloadingWhisperModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download', { modelSize: size });
            toast({ title: t('toast.downloadSuccessTitle'), description: t('toast.whisperDownloaded', { size }) });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                title: t('toast.downloadFailedTitle'),
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setDownloadingWhisperModel(false);
        }
    };

    const downloadSelectedVadModel = async () => {
        const key = `vad:${forcedVadModel}`;
        setDownloadingVadModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download-vad', { vadModel: forcedVadModel });
            toast({ title: t('toast.downloadSuccessTitle'), description: t('toast.vadDownloaded') });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                title: t('toast.downloadFailedTitle'),
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        } finally {
            setDownloadingVadModel(false);
        }
    };

    const testProvider = async (provider: 'openai' | 'tencent' | 'youdao') => {
        const setTesting = {
            openai: setTestingOpenAi,
            tencent: setTestingTencent,
            youdao: setTestingYoudao,
        }[provider];
        const setResult = {
            openai: setOpenAiTestResult,
            tencent: setTencentTestResult,
            youdao: setYoudaoTestResult,
        }[provider];

        setTesting(true);
        setResult(null);

        try {
            await flushPendingSave();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setResult({ success: false, message: `自动保存设置失败，请稍后重试：${message}` });
            setTesting(false);
            return;
        }

        try {
            const routeMap: Record<typeof provider, 'settings/services/test-openai' | 'settings/services/test-tencent' | 'settings/services/test-youdao'> = {
                openai: 'settings/services/test-openai',
                tencent: 'settings/services/test-tencent',
                youdao: 'settings/services/test-youdao',
            };
            const result = await api.call(routeMap[provider]);
            setResult(result);
        } catch (error) {
            setResult({ success: false, message: `连接测试时发生错误: ${error}` });
        } finally {
            setTesting(false);
        }
    };

    const whisperBaseReady = !!whisperModelStatus?.whisper?.base?.exists;
    const whisperLargeReady = !!whisperModelStatus?.whisper?.large?.exists;
    const currentModelReady = whisperModelSize === 'large' ? whisperLargeReady : whisperBaseReady;
    const vadReady = !!whisperModelStatus?.vad?.[forcedVadModel]?.exists;

    const openAiResultText = openAiTestResult ? openAiTestResult.message : '';
    const tencentResultText = tencentTestResult ? tencentTestResult.message : '';
    const youdaoResultText = youdaoTestResult ? youdaoTestResult.message : '';

    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit(runSave)().catch((error) => logger.error('manual submit failed', { error }));
            }}
            className="w-full h-full min-h-0 flex flex-col"
        >
            <SettingsPage
                title="密钥与模型"
                description="配置各服务的密钥、模型与本地模型下载"
            >
                <Tabs defaultValue="openai" className="flex flex-col gap-4">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="openai">OpenAI</TabsTrigger>
                        <TabsTrigger value="tencent">腾讯云</TabsTrigger>
                        <TabsTrigger value="youdao">有道</TabsTrigger>
                        <TabsTrigger value="whisper">Whisper</TabsTrigger>
                    </TabsList>

                    <TabsContent value="openai" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>OpenAI</CardTitle>
                                <CardDescription>配置 OpenAI API Key、Endpoint 与默认模型</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>API Key</Label>
                                    <Input type="password" {...register('openai.apiKey')} placeholder="sk-..." />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Endpoint</Label>
                                    <Input {...register('openai.endpoint')} placeholder="https://api.openai.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>默认模型</Label>
                                    <Select
                                        value={watch('openai.model')}
                                        onValueChange={(value) => setValue('openai.model', value)}
                                    >
                                        <SelectTrigger className="w-72">
                                            <SelectValue placeholder="选择模型" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {OPENAI_MODEL_PRESETS.map((p) => (
                                                <SelectItem key={p.value} value={p.value}>
                                                    {p.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={testingOpenAi}
                                        onClick={() => testProvider('openai')}
                                    >
                                        {testingOpenAi ? '测试中...' : '测试连接'}
                                    </Button>
                                    {openAiResultText ? (
                                        <div className={openAiTestResult?.success ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                                            {openAiResultText}
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="tencent" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>腾讯云</CardTitle>
                                <CardDescription>配置腾讯翻译 SecretId/SecretKey</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>SecretId</Label>
                                    <Input {...register('tencent.secretId')} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>SecretKey</Label>
                                    <Input type="password" {...register('tencent.secretKey')} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={testingTencent}
                                        onClick={() => testProvider('tencent')}
                                    >
                                        {testingTencent ? '测试中...' : '测试连接'}
                                    </Button>
                                    {tencentResultText ? (
                                        <div className={tencentTestResult?.success ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                                            {tencentResultText}
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="youdao" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>有道</CardTitle>
                                <CardDescription>配置有道词典密钥</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>secretId</Label>
                                    <Input {...register('youdao.secretId')} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>secretKey</Label>
                                    <Input type="password" {...register('youdao.secretKey')} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={testingYoudao}
                                        onClick={() => testProvider('youdao')}
                                    >
                                        {testingYoudao ? '测试中...' : '测试连接'}
                                    </Button>
                                    {youdaoResultText ? (
                                        <div className={youdaoTestResult?.success ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                                            {youdaoResultText}
                                        </div>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="whisper" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Whisper (本地)</CardTitle>
                                <CardDescription>配置本地 Whisper 模型与下载</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>模型大小</Label>
                                    <Select
                                        value={whisperModelSize}
                                        onValueChange={(value) => setValue('local.whisper.modelSize', value as 'base' | 'large')}
                                    >
                                        <SelectTrigger className="w-56">
                                            <SelectValue placeholder="选择模型大小" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="base">base</SelectItem>
                                            <SelectItem value="large">large</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>VAD 配置</Label>
                                    <Textarea
                                        value={`enableVad: ${watch('local.whisper.enableVad') ? 'true' : 'false'}\nvadModel: ${forcedVadModel}`}
                                        readOnly
                                        className="min-h-[64px]"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="text-sm">
                                        当前模型状态：{currentModelReady ? <span className="text-green-600">已下载</span> : <span className="text-red-600">未下载</span>}
                                    </div>
                                    <Button
                                        type="button"
                                        disabled={downloadingWhisperModel}
                                        onClick={downloadSelectedWhisperModel}
                                    >
                                        {downloadingWhisperModel ? '下载中...' : `下载 Whisper ${whisperModelSize}`}
                                    </Button>
                                    {downloadProgressByKey[`whisper:${whisperModelSize}`] ? (
                                        <Progress value={downloadProgressByKey[`whisper:${whisperModelSize}`]?.percent ?? 0} />
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="text-sm">
                                        VAD 模型：{vadReady ? <span className="text-green-600">已下载</span> : <span className="text-red-600">未下载</span>}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={downloadingVadModel}
                                        onClick={downloadSelectedVadModel}
                                    >
                                        {downloadingVadModel ? '下载中...' : '下载 VAD 模型'}
                                    </Button>
                                    {downloadProgressByKey[`vad:${forcedVadModel}`] ? (
                                        <Progress value={downloadProgressByKey[`vad:${forcedVadModel}`]?.percent ?? 0} />
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </SettingsPage>
        </form>
    );
}
