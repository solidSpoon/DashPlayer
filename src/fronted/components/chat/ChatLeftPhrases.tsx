import React from "react";
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import { RefreshCcw } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Skeleton } from '@/fronted/components/ui/skeleton';

const ChatLeftPhrases = ({ className}: {
    className: string,
}) => {
    const res = useChatPanel(state => state.newPhrase);
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
                    {/*<CardDescription>Manage player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {res?.hasNewPhrase && res?.phrases?.map((word, i) => (
                        <div key={i} className="flex flex-col items-start px-4 py-2">
                            <div className="flex flex-col items-start text-md text-gray-700 text-base">
                                <Playable className={cn('text-lg font-medium leading-none')}>{word.phrase}</Playable>
                                <div className={cn('text-sm text-muted-foreground')}>{word.meaning}</div>
                            </div>
                        </div>
                    ))}
                    {!res && <><Skeleton className={'h-6'} /><Skeleton className={'h-6 mt-2'} /><Skeleton className={'h-6 mt-2'} /></>}
                    {res && !res.hasNewPhrase && <div className="text-lg text-gray-700">没有短语</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default ChatLeftPhrases;
