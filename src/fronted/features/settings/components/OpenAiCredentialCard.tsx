import React from 'react';
import { UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Copy, ExternalLink, ListPlus, Loader2, Plus, TestTube, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { Badge } from '@/fronted/components/ui/badge';
import { Button } from '@/fronted/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/fronted/components/ui/dialog';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';
import { OpenAiModelUsageFeature } from '@/common/utils/cloud-model-usage';
import { CLOUD_AI_PROVIDER_PRESETS } from '@/common/constants/cloud-ai-provider-presets';
import { AI_API_FORMATS, AiApiFormat } from '@/common/utils/cloud-ai-api-format';
import toast from 'react-hot-toast';

/** 单个模型的连通性测试结果。 */
export interface OpenAiModelTestResult {
    success: boolean;
    message: string;
}

interface OpenAiCredentialCardProps {
    form: UseFormReturn<ServiceCredentialSettingDetailVO>;
    /**
     * 按模型标识现算的占用功能列表。
     *
     * 来源是功能设置区（引擎选择/整句讲解开关）的当前表单值，而非后端详情
     * 快照——在下面把某功能切到某个云端模型，上表的「使用中」角标与删除
     * 拦截立刻跟着变，不等保存刷新。
     */
    usageByModel: Map<string, OpenAiModelUsageFeature[]>;
    /** 正在测试的模型标识；非空时其余测试按钮一并禁用。 */
    testingModel: string | null;
    /** 按模型标识缓存的最近一次测试结果。 */
    testResults: Record<string, OpenAiModelTestResult | null>;
    onTestModel: (model: string) => void;
    /** 模型从列表中删除时回调，用于清理该模型遗留的测试结果。 */
    onModelRemoved: (model: string) => void;
    /** 复制文本到剪贴板（提示由调用方处理）。 */
    onCopy: (text: string) => void;
    /** 在系统浏览器中打开地址。 */
    onOpenUrl: (url: string) => void;
    disabled?: boolean;
}

/**
 * 云端服务卡片中的 OpenAI 区块：密钥、接口地址与可用模型列表。
 *
 * 预设通过「使用预设」弹窗选择，选中后回填接口地址与 API 类型，不预填
 * 模型；弹窗里同时提供各厂商控制台网址的复制与跳转，方便申请 API Key。
 *
 * 连通性测试按模型逐行进行，结果就展示在该模型所在行，避免一个按钮只测
 * 某一个模型、用户却不知道测了谁。
 */
export const OpenAiCredentialCard: React.FC<OpenAiCredentialCardProps> = ({
    form,
    usageByModel,
    testingModel,
    testResults,
    onTestModel,
    onModelRemoved,
    onCopy,
    onOpenUrl,
    disabled,
}) => {
    const { t } = useTranslation('settings');
    const { register, setValue } = form;
    const [newModel, setNewModel] = React.useState('');
    const [presetDialogOpen, setPresetDialogOpen] = React.useState(false);

    // 渲染期 watch() 不会订阅字段变化，改用 useWatch 让 API 类型与模型表随 setValue 即时刷新
    const apiFormat = useWatch({ control: form.control, name: 'openai.apiFormat' }) ?? 'openai';
    const openAiModels = useWatch({ control: form.control, name: 'openai.models' }) ?? [];

    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('serviceCredentials.openai.usageSentenceLearning'),
        subtitleTranslation: t('serviceCredentials.openai.usageSubtitleTranslation'),
        dictionary: t('serviceCredentials.openai.usageDictionary'),
    }), [t]);

    const apiFormatLabelMap: Record<AiApiFormat, string> = React.useMemo(() => ({
        openai: t('serviceCredentials.openai.apiFormatOpenai'),
        anthropic: t('serviceCredentials.openai.apiFormatAnthropic'),
        gemini: t('serviceCredentials.openai.apiFormatGemini'),
    }), [t]);

    /** 选中预设后回填接口地址与 API 类型；不触碰密钥与模型列表。 */
    const applyPreset = (presetId: string) => {
        const preset = CLOUD_AI_PROVIDER_PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        setValue('openai.endpoint', preset.endpoint, { shouldDirty: true });
        setValue('openai.apiFormat', preset.apiFormat, { shouldDirty: true });
        setPresetDialogOpen(false);
    };

    const handleAddModel = () => {
        const model = newModel.trim();
        if (!model) return;
        if (openAiModels.includes(model)) {
            toast.error(`${t('common.saveFailed')}\n${t('serviceCredentials.openai.duplicateModel', { model })}`);
            return;
        }
        setValue('openai.models', [...openAiModels, model], { shouldDirty: true });
        setNewModel('');
    };

    const handleDeleteModel = (model: string) => {
        if (!openAiModels.includes(model) || (usageByModel.get(model)?.length ?? 0) > 0) return;
        setValue(
            'openai.models',
            openAiModels.filter((item) => item !== model),
            { shouldDirty: true },
        );
        onModelRemoved(model);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" {...register('openai.key')} placeholder="sk-..." />
                <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.keyHint')}</div>
            </div>
            <div className="space-y-2">
                <Label>{t('serviceCredentials.openai.apiFormatLabel')}</Label>
                <Select
                    value={apiFormat}
                    onValueChange={(value: AiApiFormat) => setValue('openai.apiFormat', value, { shouldDirty: true })}
                >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {AI_API_FORMATS.map((format) => (
                            <SelectItem key={format} value={format}>{apiFormatLabelMap[format]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <Label>Endpoint</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPresetDialogOpen(true)}
                    >
                        <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                        {t('serviceCredentials.openai.usePreset')}
                    </Button>
                </div>
                <Input
                    {...register('openai.endpoint')}
                    placeholder={t('serviceCredentials.openai.endpointPlaceholder')}
                />
                <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.endpointHint')}</div>
            </div>
            <div className="space-y-2">
                <Label>{t('serviceCredentials.openai.modelsLabel')}</Label>
                <div className="rounded-md border border-border/70 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('serviceCredentials.openai.tableModel')}</TableHead>
                                <TableHead>{t('serviceCredentials.openai.tableUsage')}</TableHead>
                                <TableHead className="w-48">{t('serviceCredentials.openai.tableStatus')}</TableHead>
                                <TableHead className="w-40 text-right">{t('serviceCredentials.openai.tableAction')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {openAiModels.map((model) => {
                                const isTestingThisModel = testingModel === model;
                                const result = testResults[model];
                                const usage = usageByModel.get(model) ?? [];

                                return (
                                    <TableRow key={model}>
                                        <TableCell className="font-mono text-sm">{model}</TableCell>
                                        <TableCell>
                                            {usage.length > 0
                                                ? usage.map((feature) => usageLabelMap[feature]).join(' / ')
                                                : t('serviceCredentials.openai.usageNone')}
                                        </TableCell>
                                        <TableCell>
                                            {result ? (
                                                <span
                                                    className={cn(
                                                        'inline-flex max-w-full items-center gap-1 text-xs',
                                                        result.success ? 'text-green-600 dark:text-green-400' : 'text-destructive',
                                                    )}
                                                >
                                                    {result.success
                                                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                                        : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                                                    <span className="truncate" title={result.message}>{result.message}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    {t('serviceCredentials.openai.statusUntested')}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="min-w-24 justify-center whitespace-nowrap"
                                                    disabled={disabled || testingModel !== null}
                                                    onClick={() => onTestModel(model)}
                                                >
                                                    {isTestingThisModel ? (
                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <TestTube className="mr-1.5 h-3.5 w-3.5" />
                                                    )}
                                                    {isTestingThisModel ? t('common.testing') : t('serviceCredentials.openai.tableTest')}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={usage.length > 0}
                                                    onClick={() => handleDeleteModel(model)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        value={newModel}
                        onChange={(event) => setNewModel(event.target.value)}
                        placeholder={t('serviceCredentials.openai.addPlaceholder')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddModel();
                            }
                        }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddModel}>
                        <Plus className="w-4 h-4 mr-1" />
                        {t('serviceCredentials.openai.addButton')}
                    </Button>
                </div>
                <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.usedByHint')}</div>
            </div>

            {/* 厂商预设弹窗：选择后回填接口地址与 API 类型 */}
            <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
                <DialogContent className="sm:max-w-[640px] rounded-xl p-6">
                    <DialogHeader>
                        <DialogTitle>{t('serviceCredentials.openai.presetDialogTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('serviceCredentials.openai.presetDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
                        {CLOUD_AI_PROVIDER_PRESETS.map((preset) => (
                            <div
                                key={preset.id}
                                className="rounded-lg border border-border/70 p-3 space-y-2"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{preset.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {apiFormatLabelMap[preset.apiFormat]}
                                        </Badge>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => applyPreset(preset.id)}
                                    >
                                        {t('serviceCredentials.openai.useThisPreset')}
                                    </Button>
                                </div>
                                <div className="truncate font-mono text-xs text-muted-foreground" title={preset.endpoint}>
                                    {preset.endpoint}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs text-muted-foreground" title={preset.consoleUrl}>
                                        {preset.consoleUrl}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => onCopy(preset.consoleUrl)}
                                        >
                                            <Copy className="mr-1 h-3 w-3" />
                                            {t('serviceCredentials.openai.copyLink')}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => onOpenUrl(preset.consoleUrl)}
                                        >
                                            <ExternalLink className="mr-1 h-3 w-3" />
                                            {t('serviceCredentials.openai.openInBrowser')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
