import React, {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {AiAnalyseNewWordsRes} from "@/common/types/AiAnalyseNewWordsRes";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/fronted/components/ui/card";

const api = window.electron;
const ChatLeftWords = ({sentence, className, updatePoint}: {
    sentence: string,
    className: string,
    updatePoint?: (p: string[]) => void
}) => {
    const [taskId, setTaskId] = useState<number>(null);
    const dpTask: DpTask | null = useDpTask(taskId, 250);
    useEffect(() => {
        const runEffect = async () => {
            const taskId = await api.aiAnalyzeNewWords(sentence);
            setTaskId(taskId);
        }
        runEffect();
    }, [sentence]);
    useEffect(() => {
        if (dpTask?.status === DpTaskState.DONE) {
            const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseNewWordsRes;
            if (res?.hasNewWord) {
                updatePoint(res.words.map(w => w.word));
            }
        }
    }, [dpTask?.result, dpTask?.status, updatePoint]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseNewWordsRes;
    console.log('res', res, dpTask?.result);
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
                            <div className="flex items-end gap-2 text-md text-gray-700 text-lg">
                                <div className={cn('')}>{word.word}</div>
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
