import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {DpTask, DpTaskState} from '@/backend/infrastructure/db/tables/dpTask';
import {emptyFunc} from '@/common/utils/Util';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;

type UseDpTaskCenterState = {
    tasks: Map<number, DpTask | 'init'>;
};

type DpTaskConfig = {
    onFinish?: (task: DpTask) => void;
    onUpdated?: (task: DpTask) => void;
};
type UseDpTaskCenterStateAction = {
    register(func: () => Promise<number>, config?: DpTaskConfig): Promise<number>;
    tryRegister(taskId: number): void;
};

const useDpTaskCenter = create(
    subscribeWithSelector<UseDpTaskCenterState & UseDpTaskCenterStateAction>((set, get) => ({
        tasks: new Map(),
        register: async (func, config) => {
            // 1. 执行后端任务创建函数
            const taskId = await func();

            // 2. (可选) 立即获取一次任务状态，填充缓存
            // 这样UI可以几乎无延迟地显示 "初始化中..."
            get().tryRegister(taskId);

            // 3. 使用 zustand.subscribe 来处理回调
            const onUpdated = config?.onUpdated ?? emptyFunc;
            const onFinish = config?.onFinish ?? emptyFunc;

            // 如果有任何回调，则创建订阅
            if (config?.onFinish || config?.onUpdated) {
                const unsubscribe = useDpTaskCenter.subscribe(
                    // 订阅 specific task 的变化
                    state => state.tasks.get(taskId),
                    (task, previousTask) => {
                        if (task && task !== 'init') {
                            // 触发 onUpdated 回调
                            onUpdated(task);

                            // 检查是否为最终状态
                            const isFinalState =
                                task.status === DpTaskState.DONE ||
                                task.status === DpTaskState.FAILED ||
                                task.status === DpTaskState.CANCELLED;

                            if (isFinalState) {
                                // 触发 onFinish 回调
                                onFinish(task);
                                // 任务结束后，自动取消订阅，避免内存泄漏
                                unsubscribe();
                            }
                        }
                    }
                );
            }

            return taskId;
        },
        tryRegister: async (taskId) => {
            const existing = get().tasks.get(taskId);
            if (existing && existing !== 'init') return existing as DpTask;
            if (existing === 'init') return null;

            set(state => ({tasks: new Map(state.tasks).set(taskId, 'init')}));
            try {
                const task = await api.call('dp-task/detail', taskId);
                if (!task) {
                    getRendererLogger('useDpTaskCenter').warn('task not found, removing from cache', { taskId });
                    set(state => {
                        const newTasks = new Map(state.tasks);
                        newTasks.delete(taskId);
                        return {tasks: newTasks};
                    });
                    return null;
                }
                set(state => ({tasks: new Map(state.tasks).set(taskId, task)}));
                return task;
            } catch (error) {
                getRendererLogger('useDpTaskCenter').error('failed to fetch initial task state', { taskId, error });
                set(state => {
                    const newTasks = new Map(state.tasks);
                    newTasks.delete(taskId);
                    return {tasks: newTasks};
                });
                return null;
            }
        },
    }))
);

export default useDpTaskCenter;

// --- 全局监听器管理 (不变) ---
let cleanupListener: (() => void) | null = null;
export const startListeningToDpTasks = () => {
    if (!cleanupListener) {
        cleanupListener = api.onTaskUpdate((updatedTask: DpTask) => {
            if (!updatedTask || !updatedTask.id) return;
              useDpTaskCenter.setState(state => ({
                tasks: new Map(state.tasks).set(updatedTask.id, updatedTask)
            }));
        });
    }
};
export const stopListeningToDpTasks = () => {
    if (cleanupListener) {
        cleanupListener();
        cleanupListener = null;
    }
};

export const getDpTask = async (taskId: number | null | undefined): Promise<DpTask | null> => {
    if (taskId === null || taskId === undefined) {
        return null;
    }
    useDpTaskCenter.getState().tryRegister(taskId);
    const task = useDpTaskCenter.getState().tasks.get(taskId);
    if (task === 'init' || !task || task.status !== DpTaskState.DONE) {
        return api.call('dp-task/detail', taskId);
    }
    return task;
};

export const getDpTaskResult = async <T>(taskId: number | null | undefined, isString = false): Promise<T | null> => {
    if (taskId === null || taskId === undefined) {
        return null;
    }
    const task = await getDpTask(taskId);
    if (task?.status !== DpTaskState.DONE) {
        return null;
    }
    if (task?.result === null) {
        return null;
    }
    try {
        if (isString) {
            return task.result as unknown as T;
        }
        return JSON.parse(task.result);
    } catch (e) {
        getRendererLogger('useDpTaskCenter').error('task center error', { error: e });
        return null;
    }
};
export const registerDpTask = async (func: () => Promise<number>, config?: DpTaskConfig): Promise<number> => {
    return useDpTaskCenter.getState().register(func, config);
};
