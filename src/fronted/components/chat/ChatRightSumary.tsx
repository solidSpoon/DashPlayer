import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";

import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import {AiMakeExampleSentencesRes} from "@/common/types/AiMakeExampleSentencesRes";

const api = window.electron;
const ChatRightSummary = ({sentence, points, className}: {
    sentence: string,
    points: string[],
    className: string,
}) => {
    const [taskId, setTaskId] = useState<number>(null);
    const dpTask: DpTask | null = useDpTask(taskId, 250);
    useEffect(() => {
        const runEffect = async () => {
            const taskId = await api.aiMakeExampleSentences(sentence, points);
            setTaskId(taskId);
        }
        runEffect();
    }, [points, sentence]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiMakeExampleSentencesRes;
    console.log('res', res, dpTask?.result);
    return (

        <div className={cn('flex flex-col gap-2', className)}>

            {res?.sentences?.map((s, i) => (
                s?.sentence ?? '' +
                s?.meaning ?? '' +
                s?.points ?? []

            ))}
            {
                !res && <div className="text-lg text-gray-700">生成总结中...</div>
            }
        </div>

    )
}

export default ChatRightSummary;
