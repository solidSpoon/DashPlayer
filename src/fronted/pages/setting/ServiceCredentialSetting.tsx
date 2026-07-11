import React from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Book, Bot, CheckCircle2, Cpu, Download, Languages, Plus, ShieldCheck, TestTube, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Progress } from '@/fronted/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { OpenAiModelUsageFeature, ServiceCredentialSettingDetailVO, ServiceCredentialSettingSaveVO } from '@/common/types/vo/service-credentials-setting-vo';
import { ParakeetModelStatusVO } from '@/common/types/vo/parakeet-model-vo';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useToast } from '@/fronted/components/ui/use-toast';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useAutoSaveSettingsForm } from '@/fronted/hooks/useAutoSaveSettingsForm';

const api = backendClient;

/**
 * 服务凭据设置页。
 */
const ServiceCredentialSetting = () => {
    const { t } = useI18nTranslation('settings');
    const { toast } = useToast();
    const { data: settings } = useSWR('settings/service-credentials/detail', () =>
        api.call('settings/service-credentials/detail'),
    );

    const form = useForm<ServiceCredentialSettingDetailVO>();
    const { register, setValue, watch } = form;

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
            await api.call('settings/service-credentials/save', payload);
        },
    });

    const [testingOpenAi, setTestingOpenAi] = React.useState(false);
    const [testingTencent, setTestingTencent] = React.useState(false);
    const [testingYoudao, setTestingYoudao] = React.useState(false);
    const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; message: string } | null>>({});
    const [parakeetModelStatus, setParakeetModelStatus] = React.useState<ParakeetModelStatusVO | null>(null);
    const [downloadingParakeetModel, setDownloadingParakeetModel] = React.useState(false);
    const [parakeetDownloadProgress, setParakeetDownloadProgress] = React.useState(0);
    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('engineSelection.sentenceLearning.title'),
        subtitleTranslation: t('engineSelection.subtitleTranslation.title'),
        dictionary: t('engineSelection.dictionary.title'),
    }), [t]);

    const openAiModels = watch('openai.models');
    const [newOpenAiModel, setNewOpenAiModel] = React.useState('');

    /**
     * 刷新 Parakeet 模型状态。
     */
    const refreshParakeetModelStatus = React.useCallback(async () => {
        const status = await api.call('parakeet/models/status');
        setParakeetModelStatus(status);
    }, []);

    React.useEffect(() => {
        if (!settings) {
            return;
        }
        initialize(settings);
    }, [initialize, settings]);

    React.useEffect(() => {
        refreshParakeetModelStatus().catch(() => null);
    }, [refreshParakeetModelStatus]);

    React.useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent).detail as { percent: number } | undefined;
            if (!detail) return;
            setParakeetDownloadProgress(detail.percent);

            if (detail.percent >= 100) {
                setTimeout(() => {
                    refreshParakeetModelStatus().catch(() => null);
                }, 300);
            }
        };

        window.addEventListener('parakeet-model-download-progress', handler as EventListener);
        return () => {
            window.removeEventListener('parakeet-model-download-progress', handler as EventListener);
        };
    }, [refreshParakeetModelStatus]);

    /**
     * 测试指定服务商连通性。
     */
    const testProvider = async (provider: 'openai' | 'tencent' | 'youdao') => {
        try {
            await flush();
        } catch (flushError) {
            toast({
                variant: 'destructive',
                title: t('common.saveFailed'),
                description: flushError instanceof Error ? flushError.message : String(flushError),
            });
            return;
        }

        const setTesting = {
            openai: setTestingOpenAi,
            tencent: setTestingTencent,
            youdao: setTestingYoudao,
        }[provider];

        setTesting(true);
        setTestResults((prev) => ({ ...prev, [provider]: null }));
        try {
            const routeMap: Record<typeof provider, 'settings/service-credentials/test-openai' | 'settings/service-credentials/test-tencent' | 'settings/service-credentials/test-youdao'> = {
                openai: 'settings/service-credentials/test-openai',
                tencent: 'settings/service-credentials/test-tencent',
                youdao: 'settings/service-credentials/test-youdao',
            };
            const result = await api.call(routeMap[provider]);
            setTestResults((prev) => ({ ...prev, [provider]: result }));
        } catch (error) {
            setTestResults((prev) => ({
                ...prev,
                [provider]: { success: false, message: error instanceof Error ? error.message : String(error) },
            }));
        } finally {
            setTesting(false);
        }
    };

    /**
     * 添加 OpenAI 可用模型。
     */
    const handleAddOpenAiModel = () => {
        const model = newOpenAiModel.trim();
        if (!model) {
            return;
        }
        if (!openAiModels) {
            throw new Error('openai.models 未初始化');
        }
        if (openAiModels.some((item) => item.model === model)) {
            toast({
                variant: 'destructive',
                title: t('common.saveFailed'),
                description: t('serviceCredentials.openai.duplicateModel', { model }),
            });
            return;
        }
        setValue(
            'openai.models',
            [...openAiModels, { model, inUseBy: [] }],
            { shouldDirty: true },
        );
        setNewOpenAiModel('');
    };

    /**
     * 删除 OpenAI 可用模型（被占用模型禁止删除）。
     */
    const handleDeleteOpenAiModel = (model: string) => {
        if (!openAiModels) {
            throw new Error('openai.models 未初始化');
        }
        const target = openAiModels.find((item) => item.model === model);
        if (!target) {
            throw new Error(`模型不存在：${model}`);
        }
        if (target.inUseBy.length > 0) {
            return;
        }
        setValue(
            'openai.models',
            openAiModels.filter((item) => item.model !== model),
            { shouldDirty: true },
        );
    };

    /**
     * 下载固定的 Parakeet v3 INT8 模型。
     */
    const downloadParakeetModel = async () => {
        setDownloadingParakeetModel(true);
        setParakeetDownloadProgress(0);
        try {
            await api.call('parakeet/models/download');
            toast({ title: t('common.downloadDone'), description: 'Parakeet v3 模型已下载' });
            await refreshParakeetModelStatus();
        } catch (error) {
            toast({
                variant: 'destructive',
                title: t('common.downloadFailed'),
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setDownloadingParakeetModel(false);
        }
    };

    if (!ready) {
        return (
            <div className="w-full h-full min-h-0">
                <SettingsPageShell
                    title={t('serviceCredentials.title')}
                    description={t('serviceCredentials.description')}
                    contentClassName="space-y-6"
                >
                    <></>
                </SettingsPageShell>
            </div>
        );
    }
    if (!openAiModels) {
        throw new Error('openai.models 未初始化');
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
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                    {t('serviceCredentials.intro')}
                </div>

                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}

                <div className="rounded-xl border border-border/70 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="w-4 h-4" />OpenAI</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('serviceCredentials.openai.description')}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {testResults.openai && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.openai.success ? 'text-green-600' : 'text-destructive'}`}>
                                    {testResults.openai.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.openai.success ? t('common.testSuccess') : testResults.openai.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('openai').catch(() => null)} disabled={testingOpenAi || autoSaveStatus === 'saving'}>
                                <TestTube className="w-4 h-4 mr-2" />
                                {testingOpenAi ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
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
                            <Label>{t('serviceCredentials.openai.modelsLabel')}</Label>
                            <div className="rounded-md border border-border/70 overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('serviceCredentials.openai.tableModel')}</TableHead>
                                            <TableHead>{t('serviceCredentials.openai.tableUsage')}</TableHead>
                                            <TableHead className="w-28 text-right">{t('serviceCredentials.openai.tableAction')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openAiModels.map((item) => (
                                            <TableRow key={item.model}>
                                                <TableCell className="font-mono text-sm">{item.model}</TableCell>
                                                <TableCell>
                                                    {item.inUseBy.length > 0
                                                        ? item.inUseBy.map((feature) => usageLabelMap[feature]).join(' / ')
                                                        : t('serviceCredentials.openai.usageNone')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={item.inUseBy.length > 0}
                                                        onClick={() => handleDeleteOpenAiModel(item.model)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={newOpenAiModel}
                                    onChange={(event) => setNewOpenAiModel(event.target.value)}
                                    placeholder={t('serviceCredentials.openai.addPlaceholder')}
                                />
                                <Button type="button" variant="outline" onClick={handleAddOpenAiModel}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    {t('serviceCredentials.openai.addButton')}
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.usedByHint')}</div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Languages className="w-4 h-4" />{t('serviceCredentials.tencent.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('serviceCredentials.tencent.description')}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {testResults.tencent && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.tencent.success ? 'text-green-600' : 'text-destructive'}`}>
                                    {testResults.tencent.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.tencent.success ? t('common.testSuccess') : testResults.tencent.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('tencent').catch(() => null)} disabled={testingTencent || autoSaveStatus === 'saving'}>
                                <TestTube className="w-4 h-4 mr-2" />
                                {testingTencent ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
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

                <div className="rounded-xl border border-border/70 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold"><Book className="w-4 h-4" />{t('serviceCredentials.youdao.title')}</div>
                            <div className="text-xs text-muted-foreground mt-1">{t('serviceCredentials.youdao.description')}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {testResults.youdao && (
                                <span className={`flex items-center gap-1 text-xs ${testResults.youdao.success ? 'text-green-600' : 'text-destructive'}`}>
                                    {testResults.youdao.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    {testResults.youdao.success ? t('common.testSuccess') : testResults.youdao.message}
                                </span>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => testProvider('youdao').catch(() => null)} disabled={testingYoudao || autoSaveStatus === 'saving'}>
                                <TestTube className="w-4 h-4 mr-2" />
                                {testingYoudao ? t('common.testing') : t('common.testConnection')}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('serviceCredentials.youdao.appId')}</Label>
                            <Input {...register('youdao.secretId')} />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('serviceCredentials.youdao.appKey')}</Label>
                            <Input type="password" {...register('youdao.secretKey')} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 p-5 space-y-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold"><Cpu className="w-4 h-4" />Sherpa ONNX · Parakeet v3</div>
                        <div className="text-xs text-muted-foreground mt-1">本地英语字幕识别模型，INT8 版本约 640 MB。</div>
                    </div>
                    <div className="rounded-lg border border-border/60 px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm font-medium">Parakeet TDT 0.6B v3 INT8</span>
                                {parakeetModelStatus?.ready ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" />{t('common.ready')}</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('common.notDownloaded')}</span>
                                )}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => downloadParakeetModel().catch(() => null)} disabled={downloadingParakeetModel}>
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                {downloadingParakeetModel ? t('common.downloading') : t('common.download')}
                            </Button>
                        </div>
                        {downloadingParakeetModel && <Progress value={parakeetDownloadProgress} className="h-1.5" />}
                    </div>
                </div>
            </SettingsPageShell>
        </form>
    );
};

export default ServiceCredentialSetting;
