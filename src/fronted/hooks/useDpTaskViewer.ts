import { DpTask } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";
import {useEffect} from "react";

const useDpTaskViewer = (taskId: number) => {
    const task: DpTask | undefined|'init' = useDpTaskCenter((s) => s.tasks.get(taskId));
    useEffect(() => {
        if (taskId !== null && taskId !== undefined) {
            useDpTaskCenter.getState().tryRegister(taskId);
        }
    }, [taskId]);
    if (task === 'init' || task === undefined) {
        return null;
    }
    return task;
};
export default useDpTaskViewer;
