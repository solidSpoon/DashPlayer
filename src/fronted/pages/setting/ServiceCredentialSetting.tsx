import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Book, Bot, Cpu, Languages, ShieldCheck, TestTube } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import { Progress } from '@/fronted/components/ui/progress';
import { Textarea } from '@/fronted/components/ui/textarea';
import Header from '@/fronted/pages/setting/components/form/Header';
import { ServiceCredentialSettingVO } from '@/common/types/vo/service-credentials-setting-vo';
import { WhisperModelStatusVO } from '@/common/types/vo/whisper-model-vo';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useToast } from '@/fronted/components/ui/use-toast';

const api = backendClient;

const ServiceCredentialSetting = () => {
    const { toast } = useToast();
    const { data: settings, mutate, isLoading } = useSWR('settings/service-credentials/get', () =>
        api.call('settings/service-credentials/get'),
    );

    const { register, setValue, handleSubmit, watch, reset } = useForm<ServiceCredentialSettingVO>({
        defaultValues: {
            openai: { key: '', endpoint: 'https://api.openai.com', models: ['gpt-4o-mini'] },
            tencent: { secretId: '', secretKey: '' },
            youdao: { secretId: '', secretKey: '' },
            whisper: { modelSize: 'base', enableVad: true, vadModel: 'silero-v6.2.0' },
        },
    });

    register('whisper.modelSize');
    register('whisper.enableVad');
    register('whisper.vadModel');

    const [saving, setSaving] = React.useState(false);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    const [whisperModelStatus, setWhisperModelStatus] = React.useState<WhisperModelStatusVO | null>(null);
    const [downloadingWhisperModel, setDownloadingWhisperModel] = React.useState(false);
    const [downloadingVadModel, setDownloadingVadModel] = React.useState(false);
    const [downloadProgressByKey, setDownloadProgressByKey] = React.useState<Record<string, { percent: number }>>({});

    const whisperModelSize = watch('whisper.modelSize');
    const openAiModelsText = watch('openai.models')?.join('\n') ?? 'gpt-4o-mini';

    const refreshWhisperModelStatus = React.useCallback(async () => {
        const status = await api.call('whisper/models/status');
        setWhisperModelStatus(status);
    }, []);

    React.useEffect(() => {
        if (settings) {
            reset(settings);
        }
    }, [settings, reset]);

    React.useEffect(() => {
        refreshWhisperModelStatus().catch(() => null);
    }, [refreshWhisperModelStatus]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { key: string; percent: number } | undefined;
            if (!detail?.key) return;
            setDownloadProgressByKey((prev) => ({
                ...prev,
                [detail.key]: { percent: detail.percent },
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

    const onSave = handleSubmit(async (data) => {
        setSaving(true);
        try {
            await api.call('settings/service-credentials/update', data);
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

    const testProvider = async (provider: 'openai' | 'tencent' | 'youdao') => {
        const setTesting = {
            openai: setTestingOpenAi,
            tencent: setTestingTencent,
            youdao: setTestingYoudao,
        }[provider];

        setTesting(true);
        try {
            const routeMap: Record<typeof provider, 'settings/service-credentials/test-openai' | 'settings/service-credentials/test-tencent' | 'settings/service-credentials/test-youdao'> = {
                openai: 'settings/service-credentials/test-openai',
                tencent: 'settings/service-credentials/test-tencent',
                youdao: 'settings/service-credentials/test-youdao',
            };
            const result = await api.call(routeMap[provider]);
            toast({
                variant: result.success ? 'default' : 'destructive',
                title: result.success ? '测试成功' : '测试失败',
                description: result.message,
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: '测试失败',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setTesting(false);
        }
    };

    const downloadSelectedWhisperModel = async () => {
        const size = whisperModelSize === 'large' ? 'large' : 'base';
        const key = `whisper:${size}`;
        setDownloadingWhisperModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download', { modelSize: size });
            toast({ title: '下载完成', description: `Whisper 模型已下载：${size}` });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: '下载失败',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setDownloadingWhisperModel(false);
        }
    };

    const downloadSelectedVadModel = async () => {
        const key = 'vad:silero-v6.2.0';
        setDownloadingVadModel(true);
        setDownloadProgressByKey((prev) => ({ ...prev, [key]: { percent: 0 } }));
        try {
            await api.call('whisper/models/download-vad', { vadModel: 'silero-v6.2.0' });
            toast({ title: '下载完成', description: '静音检测模型已下载' });
            await refreshWhisperModelStatus();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: '下载失败',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setDownloadingVadModel(false);
        }
    };

    return (
        <form
            className="w-full h-full flex flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault();
                onSave().catch(() => null);
            }}
        >
            <Header title="服务凭据" description="管理云端 API 凭据与本地模型资源" />

            <div className="flex flex-col gap-6 h-0 flex-1 overflow-auto scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-gray-300">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 mt-0.5" />
                        凭据只负责连接能力，功能开关请在“功能设置”页面调整。
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="w-4 h-4" />OpenAI</div>
                            <div className="text-xs text-muted-foreground mt-1">用于字幕翻译、词典与云端转录能力</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => testProvider('openai').catch(() => null)} disabled={testingOpenAi}>
                            <TestTube className="w-4 h-4 mr-2" />
                            {testingOpenAi ? '测试中...' : '测试连接'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>API Key</Label>
                            <Input type="password" {...register('openai.key')} placeholder="sk-..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Endpoint</Label>
                            <Input {...register('openai.endpoint')} placeholder="https://api.openai.com" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>可用模型列表（每行一个）</Label>
                            <Textarea
                                value={openAiModelsText}
                                onChange={(event) => {
                                    const models = event.target.value
                                        .split(/[\n,]/)
                                        .map((item) => item.trim())
                                        .filter((item) => item.length > 0);
                                    setValue('openai.models', models.length > 0 ? Array.from(new Set(models)) : ['gpt-4o-mini'], { shouldDirty: true });
                                }}
                                className="min-h-[120px]"
                                placeholder={'gpt-4o-mini\ngpt-4o\no3-mini'}
                            />
                            <div className="text-xs text-muted-foreground">支持换行或逗号分隔。功能设置页会按这里的列表给各功能选模型。</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Languages className="w-4 h-4" />腾讯翻译</div>
                            <div className="text-xs text-muted-foreground mt-1">用于字幕翻译能力</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => testProvider('tencent').catch(() => null)} disabled={testingTencent}>
                            <TestTube className="w-4 h-4 mr-2" />
                            {testingTencent ? '测试中...' : '测试连接'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>SecretId</Label>
                            <Input {...register('tencent.secretId')} />
                        </div>
                        <div className="space-y-2">
                            <Label>SecretKey</Label>
                            <Input type="password" {...register('tencent.secretKey')} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Book className="w-4 h-4" />有道词典</div>
                            <div className="text-xs text-muted-foreground mt-1">用于词典查询能力</div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => testProvider('youdao').catch(() => null)} disabled={testingYoudao}>
                            <TestTube className="w-4 h-4 mr-2" />
                            {testingYoudao ? '测试中...' : '测试连接'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>应用 ID</Label>
                            <Input {...register('youdao.secretId')} />
                        </div>
                        <div className="space-y-2">
                            <Label>应用密钥</Label>
                            <Input type="password" {...register('youdao.secretKey')} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4 rounded-xl border border-border/70 bg-background p-5">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold"><Cpu className="w-4 h-4" />Whisper 本地模型</div>
                        <div className="text-xs text-muted-foreground mt-1">管理本地转录模型与静音检测模型资源</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Whisper 模型大小</Label>
                            <Select
                                value={watch('whisper.modelSize')}
                                onValueChange={(value: 'base' | 'large') => setValue('whisper.modelSize', value, { shouldDirty: true })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="base">base</SelectItem>
                                    <SelectItem value="large">large</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>VAD 模型</Label>
                            <Select
                                value={watch('whisper.vadModel')}
                                onValueChange={(value: 'silero-v5.1.2' | 'silero-v6.2.0') => setValue('whisper.vadModel', value, { shouldDirty: true })}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="silero-v6.2.0">silero-v6.2.0</SelectItem>
                                    <SelectItem value="silero-v5.1.2">silero-v5.1.2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox checked={watch('whisper.enableVad')} onCheckedChange={(checked) => setValue('whisper.enableVad', checked === true, { shouldDirty: true })} />
                        <Label>启用静音检测（VAD）</Label>
                    </div>

                    <div className="rounded-md border border-border p-3 space-y-3">
                        <div className="text-sm text-muted-foreground">
                            Whisper 状态：
                            {whisperModelStatus?.whisper?.base?.exists ? ' base 已下载；' : ' base 未下载；'}
                            {whisperModelStatus?.whisper?.large?.exists ? ' large 已下载；' : ' large 未下载；'}
                        </div>
                        {downloadingWhisperModel && (
                            <Progress value={downloadProgressByKey[`whisper:${whisperModelSize}`]?.percent ?? 0} />
                        )}
                        <Button type="button" variant="outline" onClick={() => downloadSelectedWhisperModel().catch(() => null)} disabled={downloadingWhisperModel}>
                            {downloadingWhisperModel ? '下载中...' : '下载当前 Whisper 模型'}
                        </Button>
                    </div>

                    <div className="rounded-md border border-border p-3 space-y-3">
                        <div className="text-sm text-muted-foreground">
                            VAD 状态：{whisperModelStatus?.vad?.['silero-v6.2.0']?.exists ? '已下载' : '未下载'}
                        </div>
                        {downloadingVadModel && <Progress value={downloadProgressByKey['vad:silero-v6.2.0']?.percent ?? 0} />}
                        <Button type="button" variant="outline" onClick={() => downloadSelectedVadModel().catch(() => null)} disabled={downloadingVadModel}>
                            {downloadingVadModel ? '下载中...' : '下载 VAD 模型'}
                        </Button>
                    </div>
                </div>
            </div>

        </form>
    );
};

export default ServiceCredentialSetting;
