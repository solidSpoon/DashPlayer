import React from 'react';
import ItemWrapper from '@/fronted/pages/setting/components/form/ItemWrapper';
import FooterWrapper from '@/fronted/pages/setting/components/form/FooterWrapper';
import { Button } from '@/fronted/components/ui/button';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { codeBlock } from 'common-tags';
import useSWR from 'swr';
import NewTips from '@/fronted/pages/setting/components/NewTips';
import { cn } from '@/fronted/lib/utils';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { UpdateCheckResult } from '@/common/types/update-check';
import SettingsPage from '@/fronted/pages/setting/components/SettingsPage';

const api = backendClient;

const CheckUpdate = () => {

    const { data: updateResult, isLoading: checking } = useSWR<UpdateCheckResult>('system/check-update', async () => {
        return await api.call('system/check-update');
    });

    const hasNewRelease = (updateResult?.releases?.length ?? 0) > 0;
    const hasError = updateResult?.status === 'error';

    return (
        <SettingsPage title="版本更新" className="w-full h-full">
            <ItemWrapper>
                {checking ? (
                    <div className="text-sm text-muted-foreground">
                        检查更新中...
                    </div>
                ) : (
                    <div
                        className={cn('p-4 bg-muted/40 rounded border select-text')}>

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
                        </Md> : <div className={'w-full h-full flex flex-col'}>
                            <h1>
                                已是最新版本，看看 Tips 吧
                            </h1>
                            <div className={'w-full flex justify-center items-center mt-4'}>
                                <NewTips />
                            </div>
                        </div>}
                    </div>
                )}
            </ItemWrapper>
            <FooterWrapper>
                <Button
                    onClick={async () => {
                        await api.call('system/open-url',
                            'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                >
                    前往发布页
                </Button>
            </FooterWrapper>
        </SettingsPage>
    );
};

export default CheckUpdate;
