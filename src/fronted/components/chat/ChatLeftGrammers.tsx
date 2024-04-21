import { cn } from '@/fronted/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { strBlank } from '@/common/utils/Util';
import React from 'react';
import Md from '@/fronted/components/chat/markdown';

const api = window.electron;
const ChatLeftGrammers = ({ className }: {
    className: string,
}) => {
    const res = useChatPanel(state => state.newGrammar);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none'}>
                <CardHeader>
                    <CardTitle>本句语法</CardTitle>
                    {/*<CardDescription>Manage player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    <Md>
                        {strBlank(res?.grammarsMd) ? '没有语法' : res.grammarsMd}
                    </Md>
                </CardContent>
            </Card>
        </div>
    );
};

export default ChatLeftGrammers;
