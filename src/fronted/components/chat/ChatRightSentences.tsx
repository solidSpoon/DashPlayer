import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {AiAnalyseNewWordsRes} from "@/common/types/AiAnalyseNewWordsRes";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import {AiMakeExampleSentencesRes} from "@/common/types/AiMakeExampleSentencesRes";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import Playable from "@/fronted/components/chat/Playable";

const api = window.electron;
const ChatRightSentences = ({sentence, points, className}: {
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
    }, [sentence]);
    // useEffect(() => {
    //     if (dpTask?.status === DpTaskState.DONE) {
    //         const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiMakeExampleSentencesRes;
    //         updatePoint(res.words.map(w => w.word));
    //     }
    // }, [dpTask?.result, dpTask?.status, updatePoint]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiMakeExampleSentencesRes;
    console.log('res', res, dpTask?.result);
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            {res?.sentences?.map((s, i) => (
                <div key={i}
                     className="bg-secondary flex flex-col justify-between px-4 py-2 rounded">
                    <Playable className="text-base text-gray-700 text-secondary-foreground">{s?.sentence}</Playable>
                    <div className=" text-sm text-gray-500">{s?.meaning}</div>
                    <div className={'flex flex-wrap gap-2 mt-2'}>
                        {
                            s?.points?.map((p, j) => (
                                <div key={j}
                                     className="text-xs border p-1 py-0 bg-red-50 border-red-500 text-primary-foreground rounded-full">{p}</div>
                            ))
                        }
                    </div>


                </div>
            ))}
            {!res && <div className="text-lg text-gray-700">生成例句中...</div>}
            {/*    </CardContent>*/}
            {/*</Card>*/}
            {/*{(res?.sentences??[]). && <div className="text-lg text-gray-700">没有生词</div>}*/}
        </div>

    )
}

export default ChatRightSentences;
