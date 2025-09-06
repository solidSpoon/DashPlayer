// src/fronted/hooks/useDpTaskViewer.ts
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { useEffect } from 'react';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { Nullable } from '@/common/types/Types';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const useDpTaskViewer = <T>(taskId: Nullable<number>): {
    task: DpTask | null,
    detail: T | null,
} => {
    useEffect(() => {
        if (TypeGuards.isNotNull(taskId)) {
            useDpTaskCenter.getState().tryRegister(taskId);
        }
    }, [taskId]);

    const taskData = useDpTaskCenter(state => TypeGuards.isNull(taskId) ? undefined : state.tasks.get(taskId));

    if (!taskData || taskData === 'init') {
        return { task: null, detail: null };
    }

    const task = taskData;
    let detail: T | null = null;

    if (task.result) { // 不再检查 task.status === DpTaskState.DONE
        try {
            // console.log('on task update parse', task.id);
            detail = JSON.parse(task.result);
        } catch (e) {
            // 在流式场景下，后端传来的数据可能暂时不完整，解析失败是可能的
            // 可以选择静默处理，或者只在非最终状态下静默
            if (task.status === DpTaskState.DONE) {
                getRendererLogger('useDpTaskViewer').error('failed to parse final task result', { taskId: task.id, error: e });
            }
        }
    }

    return { task, detail };
};

export default useDpTaskViewer;
