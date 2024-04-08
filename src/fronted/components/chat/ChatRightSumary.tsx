import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask} from "@/backend/db/tables/dpTask";

import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import SentenceT from "@/common/types/SentenceT";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {AiSummaryRes} from "@/common/types/AiSummaryRes";
import Playable from "@/fronted/components/chat/Playable";

const api = window.electron;
const ChatRightSummary = ({sentenceT, points, className}: {
    sentenceT: SentenceT,
    points: string[],
    className: string,
}) => {
    const [taskId, setTaskId] = useState<number>(null);
    const dpTask: DpTask | null = useDpTask(taskId, 250);
    useEffect(() => {
        const runEffect = async () => {
            const sentences = usePlayerController.getState().getSubtitleAround(sentenceT?.index ?? 0);
            const taskId = await api.aiSummary(sentences.map(s => s.text));
            setTaskId(taskId);
        }
        runEffect();
    }, [points, sentenceT?.index]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiSummaryRes;
    console.log('res', res, dpTask?.result);
    return (

        <>
            {!strBlank(res?.summary) && (
                <div>{res?.summary}</div>
            )}
            {
                !res && <div className="text-lg text-gray-700">生成总结中...</div>
            }
        </>

    )
}

export default ChatRightSummary;
