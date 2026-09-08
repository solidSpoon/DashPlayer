import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, Plus, TestTube, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { Switch } from '@/fronted/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/fronted/components/ui/table';
import { SettingCard } from '@/fronted/features/settings/components/form';
import {
    OpenAiModelUsageFeature,
    ServiceCredentialSettingDetailVO,
} from '@/common/types/vo/service-credentials-setting-vo';
import toast from 'react-hot-toast';

interface OpenAiCredentialCardProps {
    form: UseFormReturn<ServiceCredentialSettingDetailVO>;
    testing: boolean;
    testResult: { success: boolean; message: string } | null | undefined;
    onTest: () => Promise<void>;
    disabled?: boolean;
}

export const OpenAiCredentialCard: React.FC<OpenAiCredentialCardProps> = ({
    form,
    testing,
    testResult,
    onTest,
    disabled,
}) => {
    const { t } = useTranslation('settings');
    const { register, setValue, watch } = form;
    const [newModel, setNewModel] = React.useState('');

    const openAiModels = watch('openai.models') ?? [];

    const usageLabelMap: Record<OpenAiModelUsageFeature, string> = React.useMemo(() => ({
        sentenceLearning: t('engineSelection.sentenceLearning.title'),
        subtitleTranslation: t('engineSelection.subtitleTranslation.title'),
        dictionary: t('engineSelection.dictionary.title'),
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
    };

    return (
        <SettingCard
            title="OpenAI"
            description={t('serviceCredentials.openai.description')}
            icon={Bot}
            headerAction={
                <div className="flex items-center gap-2">
                    {testResult && (
                        <span className={`flex items-center gap-1 text-xs ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                            {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {testResult.success ? t('common.testSuccess') : testResult.message}
                        </span>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onTest}
                        disabled={testing || disabled}
                    >
                        <TestTube className="w-3.5 h-3.5 mr-1.5" />
                        {testing ? t('common.testing') : t('common.testConnection')}
                    </Button>
                </div>
            }
        >
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
                                                onClick={() => handleDeleteModel(item.model)}
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
        </SettingCard>
    );
};
