import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import { AiAnalyseNewPhrasesRes } from "@/common/types/AiAnalyseNewPhrasesRes";

const api = window.electron;
const ChatLeftPhrases = ({sentence, className, updatePoint}: {
    sentence: string,
    className: string,
    updatePoint: (points: string[]) => void
}) => {
    const [taskId, setTaskId] = useState<number>(null);
    const dpTask: DpTask | null = useDpTask(taskId, 100);
    useEffect(() => {
        const runEffect = async () => {
            const taskId = await api.aiAnalyzeNewPhrases(sentence);
            setTaskId(taskId);
        }
        runEffect();
    }, [sentence]);
    useEffect(() => {
        if (dpTask?.status === DpTaskState.DONE) {
            const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseNewPhrasesRes;
            if (res?.hasNewPhrase) {
                updatePoint(res.phrases.map(w => w.phrase));
            }
        }
    }, [dpTask?.result, dpTask?.status, updatePoint]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseNewPhrasesRes;
    console.log('res', res, dpTask?.result);
    return (
        <div className={cn('flex flex-col', className)}>
            {res?.hasNewPhrase && res?.phrases?.map((word, i) => (
                <div key={i} className="flex flex-col justify-between px-4 py-2 border-b border-gray-200">
                    <div className="text-lg text-gray-700">{word.phrase}</div>
                    <div className="mt-2 text-sm text-gray-500">{word.meaning}</div>
                </div>
            ))}
            {!res && <div className="text-lg text-gray-700">分析短语中...</div>}
            {res && !res.hasNewPhrase && <div className="text-lg text-gray-700">没有短语</div>}
        </div>
    )
}

export default ChatLeftPhrases;
