import React from 'react';
import Header from '@/fronted/pages/setting/setting/Header';
import ItemWrapper from '@/fronted/pages/setting/setting/ItemWrapper';
import FooterWrapper from '@/fronted/pages/setting/setting/FooterWrapper';
import { Button } from '@/fronted/components/ui/button';
import Md from '@/fronted/pages/player/chat/markdown';
import { codeBlock } from 'common-tags';
import useSWR from 'swr';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import NewTips from '@/fronted/components/NewTips';
import { cn } from '@/fronted/lib/utils';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;

const CheckUpdate = () => {

    const { data: newRelease, isLoading: checking } = useSWR('system/check-update', async () => {
        return await api.call('system/check-update');
    });

    const hasNewRelease = (newRelease?.length ?? 0) > 0;

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <Header title="版本更新" />
            <ItemWrapper>
                {checking && <div className={'flex w-full flex-col gap-4 pr-40'}>
                    <Skeleton className="w-52 h-12 rounded-lg" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className=" h-8 rounded" />
                    <Skeleton className="h-8 rounded" />
                </div>}
                {!checking && (
                    <div
                        className={cn('p-4 bg-muted/40 rounded border overflow-y-auto scrollbar-thin select-text h-0 flex-1 '
                        )}>

                        {hasNewRelease ? <Md>
                            {(newRelease ?? []).map((release) => (
                                codeBlock`
                            ## ${release.version}

                            ${release.content}
                            `
                            )).join('\n---\n')}
                        </Md> : <div className={'w-full h-full flex flex-col'}>
                            <h1>
                                已是最新版本，看看 Tips 吧
                            </h1>
                            <div className={'w-full flex h-0 flex-1 justify-center items-center'}>
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
        </div>
    );
};

export default CheckUpdate;
