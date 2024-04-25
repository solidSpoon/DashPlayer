import { DpTask } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";
import {useEffect} from "react";

const useDpTaskViewer = (taskId: number) => {
    const task: DpTask | undefined = useDpTaskCenter((s) => s.tasks.get(taskId));
    useEffect(() => {
        if (taskId !== null && taskId !== undefined) {
            useDpTaskCenter.getState().tryRegister(taskId);
        }
    }, [taskId]);

    return task;
};
export default useDpTaskViewer;
