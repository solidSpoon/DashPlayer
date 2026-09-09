import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Plus, TestTube, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import {
    OpenAiModelUsageFeature,
    ServiceCredentialSettingDetailVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import toast from 'react-hot-toast';

/** 单个模型的连通性测试结果。 */
export interface OpenAiModelTestResult {
    success: boolean;
    message: string;
}

interface OpenAiCredentialCardProps {
    form: UseFormReturn<ServiceCredentialSettingDetailVO>;
    /** 正在测试的模型标识；非空时其余测试按钮一并禁用。 */
    testingModel: string | null;
    /** 按模型标识缓存的最近一次测试结果。 */
    testResults: Record<string, OpenAiModelTestResult | null>;
    onTestModel: (model: string) => void;
    /** 模型从列表中删除时回调，用于清理该模型遗留的测试结果。 */
    onModelRemoved: (model: string) => void;
    disabled?: boolean;
}

/**
 * 云端服务卡片中的 OpenAI 区块：密钥、接口地址与可用模型列表。
 *
 * 连通性测试按模型逐行进行，结果就展示在该模型所在行，避免一个按钮只测
 * 某一个模型、用户却不知道测了谁。
 */
export const OpenAiCredentialCard: React.FC<OpenAiCredentialCardProps> = ({
    form,
    testingModel,
    testResults,
    onTestModel,
    onModelRemoved,
    disabled,
}) => {
    const { t } = useTranslation('settings');
    const { register, setValue, watch } = form;
    const [newModel, setNewModel] = React.useState('');

    const openAiModels = watch('openai.models') ?? [];

    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('serviceCredentials.openai.usageSentenceLearning'),
        subtitleTranslation: t('serviceCredentials.openai.usageSubtitleTranslation'),
        dictionary: t('serviceCredentials.openai.usageDictionary'),
    }), [t]);

    const handleAddModel = () => {
        const model = newModel.trim();
        if (!model) return;
        if (openAiModels.some((item) => item.model === model)) {
            toast.error(`${t('common.saveFailed')}\n${t('serviceCredentials.openai.duplicateModel', { model })}`);
            return;
        }
        setValue(
            'openai.models',
            [...openAiModels, { model, inUseBy: [] }],
            { shouldDirty: true },
        );
        setNewModel('');
    };

    const handleDeleteModel = (model: string) => {
        const target = openAiModels.find((item) => item.model === model);
        if (!target || target.inUseBy.length > 0) return;
        setValue(
            'openai.models',
            openAiModels.filter((item) => item.model !== model),
            { shouldDirty: true },
        );
        onModelRemoved(model);
    };

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" {...register('openai.key')} placeholder="sk-..." />
            </div>
            <div className="space-y-2">
                <Label>Endpoint</Label>
                <Input {...register('openai.endpoint')} placeholder="https://api.openai.com" />
                <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="space-y-0.5">
                        <Label className="text-xs font-medium">{t('serviceCredentials.openai.autoAppendV1')}</Label>
                        <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.autoAppendV1Hint')}</div>
                    </div>
                    <Switch
                        checked={watch('openai.autoAppendV1')}
                        onCheckedChange={(checked) => setValue('openai.autoAppendV1', checked === true, { shouldDirty: true })}
                    />
                </div>
                <div className="text-xs text-muted-foreground">{t('serviceCredentials.openai.chatCompletionOnly')}</div>
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
                            {openAiModels.map((item) => {
                                const isTestingThisModel = testingModel === item.model;
                                const result = testResults[item.model];

                                return (
                                    <TableRow key={item.model}>
                                        <TableCell className="font-mono text-sm">{item.model}</TableCell>
                                        <TableCell>
                                            {item.inUseBy.length > 0
                                                ? item.inUseBy.map((feature) => usageLabelMap[feature]).join(' / ')
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
                                                    onClick={() => onTestModel(item.model)}
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
                                                    disabled={item.inUseBy.length > 0}
                                                    onClick={() => handleDeleteModel(item.model)}
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
        </div>
    );
};
