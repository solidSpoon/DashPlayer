import React from "react";
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const ChatLeftPhrases = ({ className}: {
    className: string,
}) => {
    const res = useChatPanel(state => state.newPhrase);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none'}>
                <CardHeader>
                    <CardTitle>本句词组</CardTitle>
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
                    {!res && <div className="text-lg text-gray-700">分析短语中...</div>}
                    {res && !res.hasNewPhrase && <div className="text-lg text-gray-700">没有短语</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default ChatLeftPhrases;
