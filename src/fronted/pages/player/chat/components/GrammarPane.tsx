import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import React from 'react';
import Md from '@/fronted/components/shared/markdown/Markdown';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import StrUtil from '@/common/utils/str-util';

const GrammarPane = ({ className }: {
    className: string,
}) => {
    const analysis = useChatPanel(state => state.analysis);
    const status = useChatPanel(state => state.analysisStatus);
    const detail = analysis?.grammar;
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none relative'}>
                <CardHeader>
                    <CardTitle>本句语法</CardTitle>
                    {/*<CardDescription>Manage pa-player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {(!detail && status === 'streaming') && (
                        <>
                            <Skeleton className={'h-6'} />
                            <Skeleton className={'h-6 mt-2'} />
                            <Skeleton className={'h-6 mt-2'} />
                        </>
                    )}
                    {StrUtil.isNotBlank(detail?.grammarsMd) && (
                        <Md>
                            {detail?.grammarsMd??''}
                        </Md>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default GrammarPane;
