import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import { AiAnalyseGrammersRes } from "@/common/types/AiAnalyseGrammersRes";

const api = window.electron;
const ChatLeftGrammers = ({sentence, className, updateGrammer}: {
    sentence: string,
    className: string,
    updateGrammer: (points: string[]) => void
}) => {
    const [taskId, setTaskId] = useState<number>(null);
    const dpTask: DpTask | null = useDpTask(taskId, 250);
    useEffect(() => {
        const runEffect = async () => {
            const taskId = await api.aiAnalyzeNewPhrases(sentence);
            setTaskId(taskId);
        }
        runEffect();
    }, [sentence]);
    useEffect(() => {
        if (dpTask?.status === DpTaskState.DONE) {
            const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseGrammersRes;
            if (res?.hasGrammer) {
                updateGrammer(res.grammers.map(w => w.description));
            }
        }
    }, [dpTask?.result, dpTask?.status, updateGrammer]);
    const res = strBlank(dpTask?.result) ? null : JSON.parse(dpTask?.result) as AiAnalyseGrammersRes;
    console.log('res', res, dpTask?.result);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none'}>
                <CardHeader>
                    <CardTitle>本句词组</CardTitle>
                    {/*<CardDescription>Manage player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {res?.hasGrammer && res?.grammers?.map((g, i) => (
                        <div key={i} className="flex flex-col items-start px-4 py-2">
                            <div className="flex flex-col items-start text-md text-gray-700 text-base">
                                <div className={cn('text-lg font-medium leading-none')}>{g.description}</div>
                            </div>
                        </div>
                    ))}
                    {!res && <div className="text-lg text-gray-700">分析短语中...</div>}
                    {res && !res.hasGrammer && <div className="text-lg text-gray-700">没有语法</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default ChatLeftGrammers;
