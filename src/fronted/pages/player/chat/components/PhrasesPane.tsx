import React from "react";
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from "@/fronted/hooks/useChatPanel";
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiAnalyseNewPhrasesRes } from '@/common/types/aiRes/AiAnalyseNewPhrasesRes';

const PhrasesPane = ({ className}: {
    className: string,
}) => {
    const tid = useChatPanel(state => state.tasks.phraseTask);
    const {detail} = useDpTaskViewer<AiAnalyseNewPhrasesRes>(typeof tid === 'number' ? tid : null);
    const retry = useChatPanel(state => state.retry);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none relative'}>
                <CardHeader>
                    <CardTitle>本句词组</CardTitle>
                    <Button variant={'ghost'} size={'icon'} onClick={()=>retry('phrase')}
                            className={'absolute right-2 top-2 w-8 h-8 text-gray-400 dark:text-gray-200'}>
                        <RefreshCcw className={'w-3 h-3'} />
                    </Button>
                    {/*<CardDescription>Manage pa-player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {detail?.hasPhrase && detail?.phrases?.map((word, i) => (
                        <div key={i} className="flex flex-col items-start px-4 py-2">
                            <div className="flex flex-col items-start">
                                <Playable className={cn('text-base font-medium leading-none')}>{word.phrase}</Playable>
                                <div className={cn('text-sm text-muted-foreground')}>{word.meaning}</div>
                            </div>
                        </div>
                    ))}
                    {!detail && <><Skeleton className={'h-6'} /><Skeleton className={'h-6 mt-2'} /><Skeleton className={'h-6 mt-2'} /></>}
                    {detail && !detail.hasPhrase && <div className="text-lg text-gray-700">没有短语</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default PhrasesPane;
