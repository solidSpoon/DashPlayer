import React from "react";
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const ChatLeftWords = ({ className}: {
    className: string,
}) => {
    const res = useChatPanel(state => state.newVocabulary);
    return (

        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none'}>
                <CardHeader>
                    <CardTitle>本句生词</CardTitle>
                    {/*<CardDescription>分析本句中的生词</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {res?.hasNewWord && res?.words?.map((word, i) => (
                        <div key={i} className="flex flex-col items-start px-4 py-2">
                            <div className="flex items-center gap-2 text-md text-gray-700 text-lg">
                                <Playable className={cn('')}>{word.word}</Playable>
                                <div className={cn('text-base')}>{word.meaning}</div>
                                <div className={cn(
                                    "p-0.5 text-xs text-red-900 border border-red-500 bg-red-50 rounded-md drop-shadow shadow-inner")}>
                                    {word.phonetic}
                                </div>
                            </div>
                        </div>
                    ))}
                    {!res && <div className="text-lg text-gray-700">分析生词中...</div>}
                    {res && !res.hasNewWord && <div className="text-lg text-gray-700">没有生词</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default ChatLeftWords;
