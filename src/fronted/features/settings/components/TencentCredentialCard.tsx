import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Languages, TestTube, XCircle } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { SettingCard } from '@/fronted/features/settings/components/form';
import { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';

interface TencentCredentialCardProps {
    form: UseFormReturn<ServiceCredentialSettingDetailVO>;
    testing: boolean;
    testResult: { success: boolean; message: string } | null | undefined;
    onTest: () => Promise<void>;
    disabled?: boolean;
}

export const TencentCredentialCard: React.FC<TencentCredentialCardProps> = ({
    form,
    testing,
    testResult,
    onTest,
    disabled,
}) => {
    const { t } = useTranslation('settings');
    const { register } = form;

    return (
        <SettingCard
            title={t('serviceCredentials.tencent.title')}
            description={t('serviceCredentials.tencent.description')}
            icon={Languages}
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
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>SecretId</Label>
                    <Input {...register('tencent.secretId')} />
                </div>
                <div className="space-y-2">
                    <Label>SecretKey</Label>
                    <Input type="password" {...register('tencent.secretKey')} />
                </div>
            </div>
        </SettingCard>
    );
};
