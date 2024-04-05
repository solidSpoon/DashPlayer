import { DpTask } from '@/backend/db/tables/dpTask';
import React, { useEffect } from 'react';
const api = window.electron;
const useDpTask = (taskId: number | null | undefined, interval: number) => {
    const [dpTask, setDpTask] = React.useState<DpTask | null>(null);
    useEffect(() => {
        if (!taskId) {
            return;
        }
        const fetchDpTask = async () => {
            const task = await api.dpTaskDetail(taskId);
            setDpTask(task);
        }
        fetchDpTask();
        const intervalFunc = setInterval(fetchDpTask, interval);
        return () => {
            clearInterval(intervalFunc);
        };
    }, [taskId, interval]);
    return dpTask;
};

export default useDpTask;
