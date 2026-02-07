import React from 'react';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { Button } from '@/fronted/components/ui/button';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import useSWR from 'swr';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import NewTips from '@/fronted/pages/setting/components/NewTips';
import { cn } from '@/fronted/lib/utils';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { UpdateCheckResult } from '@/common/types/update-check';

const api = backendClient;

const CheckUpdate = () => {

    const { data: updateResult, isLoading: checking } = useSWR<UpdateCheckResult>('system/check-update', async () => {
        return await api.call('system/check-update');
    });

    const hasNewRelease = (updateResult?.releases?.length ?? 0) > 0;
    const hasError = updateResult?.status === 'error';

    return (
        <SettingsPageShell
            title="版本更新"
            contentClassName="space-y-4"
            actions={(
                <Button
                    onClick={async () => {
                        await api.call('system/open-url',
                            'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                >
                    前往发布页
                </Button>
            )}
        >
                {checking && <div className={'flex w-full flex-col gap-4 pr-40'}>
                    <Skeleton className="w-52 h-12 rounded-lg" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className="h-8 rounded" />
                </div>}
                {!checking && (
                    <div
                        className={cn('p-4 bg-muted/40 rounded border overflow-y-auto scrollbar-thin select-text min-h-[280px]'
                        )}>

                        {hasError ? (
                            <div className={'w-full h-full flex flex-col gap-3'}>
                                <h1>检查更新失败</h1>
                                <p className="text-muted-foreground text-sm">
                                    {updateResult?.error ?? '暂时无法获取更新信息，请稍后重试。'}
                                </p>
                            </div>
                        ) : hasNewRelease ? <Md>
                            {(updateResult?.releases ?? []).map((release) => (
                                codeBlock`
                            ## ${release.version}

                            ${release.content}
                            `
                            )).join('\n---\n')}
                        </Md> : <div className={'w-full min-h-[220px] flex flex-col'}>
                            <h1>
                                已是最新版本，看看 Tips 吧
                            </h1>
                            <div className={'w-full flex flex-1 justify-center items-center'}>
                                <NewTips />
                            </div>
                        </div>}
                    </div>
                )}
        </SettingsPageShell>
    );
};

export default CheckUpdate;
