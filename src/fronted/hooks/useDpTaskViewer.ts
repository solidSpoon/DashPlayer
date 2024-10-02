import { DpTask } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { useEffect } from 'react';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { Nullable } from '@/common/types/Types';

const useDpTaskViewer = <T>(taskId: Nullable<number>, isString = false): {
    task: DpTask | null,
    detail: T | null,
} => {
    useEffect(() => {
        if (taskId !== null && taskId !== undefined) {
            useDpTaskCenter.getState().tryRegister(taskId);
        }
    }, [taskId]);
    const task: DpTask | undefined | 'init' = useDpTaskCenter((s) => TypeGuards.isNull(taskId) ? undefined : s.tasks.get(taskId));
    let detail: T | null = null;
    if (task === 'init' || task === undefined) {
        return { task: null, detail: null };
    }
    if (task.result) {
        if (isString) {
            return { task, detail: task.result as unknown as T };
        }
        try {
            detail = JSON.parse(task.result);
        } catch (e) {
            console.error(e);
        }
    }

    return { task, detail };
};
export default useDpTaskViewer;
