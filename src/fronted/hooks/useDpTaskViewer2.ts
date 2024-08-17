import { DpTask } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";
import {useEffect} from "react";

const useDpTaskViewer2 = <T>(taskId: number, isString = false): {
    task: DpTask | undefined| 'init',
    detail: T | null,
} => {
    const task: DpTask | undefined|'init' = useDpTaskCenter((s) => s.tasks.get(taskId));
    useEffect(() => {
        if (taskId !== null && taskId !== undefined) {
            useDpTaskCenter.getState().tryRegister(taskId);
        }
    }, [taskId]);
    let detail: T | null = null;
    if (task === 'init' || task === undefined) {
        return {task, detail: null};
    }
    if (task.result) {
        if (isString) {
            return {task, detail: task.result as unknown as T};
        }
        try {
            detail = JSON.parse(task.result);
        } catch (e) {
            console.error(e);
        }
    }

    return {task, detail};
};
export default useDpTaskViewer2;
