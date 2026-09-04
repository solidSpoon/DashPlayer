import React from 'react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard } from '@/fronted/features/settings/components/form';
import { Button } from '@/fronted/components/ui/button';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import useSWR from 'swr';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import NewTips from '@/fronted/features/settings/components/NewTips';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { UpdateCheckResult } from '@/common/types/update-check';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Compass, ExternalLink } from 'lucide-react';

const CheckUpdate = () => {
    const { t } = useI18nTranslation('settings');

    const { data: updateResult, isLoading: checking } = useSWR<UpdateCheckResult>('system/check-update', async () => {
        return await settingsApi.checkUpdate();
    });

    const hasNewRelease = (updateResult?.releases?.length ?? 0) > 0;
    const hasError = updateResult?.status === 'error';
    // 按错误码映射 i18n 文案；未知码兜底到通用失败描述，不透出后端原始信息。
    const errorText = updateResult?.error
        ? t(`checkUpdate.errors.${updateResult.error}`, { defaultValue: t('checkUpdate.failedDescription') })
        : t('checkUpdate.failedDescription');

    return (
        <SettingsPageShell
            title={t('checkUpdate.title')}
            contentClassName="space-y-6"
            actions={(
                <Button
                    onClick={async () => {
                        await settingsApi.openUrl(
                            'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                    size="sm"
                    variant="outline"
                >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    {t('checkUpdate.openReleases')}
                </Button>
            )}
        >
            <SettingCard
                title={t('checkUpdate.title')}
                description={hasNewRelease ? t('checkUpdate.newVersionFound', { defaultValue: '发现新版本可用' }) : t('checkUpdate.latestTitle')}
                icon={Compass}
            >
                <div className="p-4 select-text">
                    {checking && (
                        <div className="flex w-full flex-col gap-3 py-2">
                            <Skeleton className="w-48 h-6 rounded-lg" />
                            <Skeleton className="w-full h-4 rounded" />
                            <Skeleton className="w-3/4 h-4 rounded" />
                            <Skeleton className="w-1/2 h-4 rounded" />
                        </div>
                    )}
                    {!checking && (
                        <div className="min-h-[200px]">
                            {hasError ? (
                                <div className="w-full flex flex-col gap-2 text-destructive">
                                    <h3 className="font-semibold text-sm">{t('checkUpdate.failedTitle')}</h3>
                                    <p className="text-xs text-muted-foreground">{errorText}</p>
                                </div>
                            ) : hasNewRelease ? (
                                <div className="space-y-4">
                                    <Md>
                                        {(updateResult?.releases ?? []).map((release) => (
                                            codeBlock`
                                        ## ${release.version}

                                        ${release.content}
                                        `
                                        )).join('\n---\n')}
                                    </Md>
                                </div>
                            ) : (
                                <div className="w-full min-h-[180px] flex flex-col items-center justify-center gap-3 py-4">
                                    <NewTips />
                                    <p className="text-xs text-muted-foreground">
                                        {t('checkUpdate.latestTitle')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SettingCard>
        </SettingsPageShell>
    );
};

export default CheckUpdate;
