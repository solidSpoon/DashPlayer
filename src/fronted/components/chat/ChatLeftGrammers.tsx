import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { strBlank } from '@/common/utils/Util';
import React from 'react';
import Md from '@/fronted/components/chat/markdown';
import { Button } from '@/fronted/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/fronted/components/ui/skeleton';

const api = window.electron;
const ChatLeftGrammers = ({ className }: {
    className: string,
}) => {
    const retry = useChatPanel(state => state.retry);
    const res = useChatPanel(state => state.newGrammar);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none relative'}>
                <CardHeader>
                    <CardTitle>本句语法</CardTitle>
                    <Button variant={'ghost'} size={'icon'} onClick={() => retry('grammar')}
                            className={'absolute right-2 top-2 w-8 h-8 text-gray-400 dark:text-gray-200'}>
                        <RefreshCcw className={'w-3 h-3'} />
                    </Button>
                    {/*<CardDescription>Manage player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {!res && <><Skeleton className={'h-6'} /><Skeleton className={'h-6 mt-2'} /><Skeleton
                        className={'h-6 mt-2'} /></>}
                    {res && (
                        <Md>
                            {res?.hasGrammar ? res.grammarsMd : '没有语法'}
                        </Md>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ChatLeftGrammers;
