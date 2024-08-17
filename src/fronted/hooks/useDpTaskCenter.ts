import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import { emptyFunc, sleep } from '@/common/utils/Util';

const api = window.electron;

export interface Listener {
    taskId: number;
    onFinish: (task: DpTask) => void;
    onUpdated: (task: DpTask) => void;
    createAt: number;
    interval: number;
}

type UseDpTaskCenterState = {
    listeners: Listener[];
    tasks: Map<number, DpTask | 'init'>;
};

type DpTaskConfig = {
    interval?: number;
    onFinish?: (task: DpTask) => void;
    onUpdated?: (task: DpTask) => void;
};
type UseDpTaskCenterStateAction = {
    register(func: () => Promise<number>, config?: DpTaskConfig): Promise<number>;
    tryRegister(taskId: number): void;
};

const useDpTaskCenter = create(
    subscribeWithSelector<UseDpTaskCenterState & UseDpTaskCenterStateAction>((set, get) => ({
        listeners: [],
        tasks: new Map(),
        register: async (func, config) => {
            const taskId = await func();
            const tasks = new Map(get().tasks);
            tasks.set(taskId, 'init');
            set({ tasks });
            const newListeners = [...get().listeners];

            const time = new Date().getTime();
            newListeners.push({
                taskId,
                onFinish: config?.onFinish ?? emptyFunc,
                onUpdated: config?.onUpdated ?? emptyFunc,
                interval: config?.interval ?? 1000,
                createAt: time
            });
            console.log('register', taskId, newListeners);
            set({ listeners: newListeners });
            return taskId;
        },
        tryRegister(taskId: number) {
            if (!get().tasks.has(taskId)) {
                get().register(async () => taskId);
            }
        }
    }))
);

export default useDpTaskCenter;

let running = false;
useDpTaskCenter.subscribe(
    (s) => s.listeners,
    async () => {
        console.log('try start fetching tasks');
        if (running) return;
        running = true;
        console.log('start fetching tasks');

        const localTasks: Map<number, Listener> = new Map();
        const updateMapping = new Map<number, number>();
        const listeners = useDpTaskCenter.getState().listeners;
        listeners.forEach(l => {
            localTasks.set(l.taskId, l);
            updateMapping.set(l.taskId, 0);
            console.log('add tasks listener', l.taskId);
        });
        useDpTaskCenter.getState().listeners.splice(0);
        while (localTasks.size > 0) {
            let sleepTime = 1000;
            const time = new Date().getTime();
            const taskIds = Array.from(localTasks.values())
                .filter(l => time - updateMapping.get(l.taskId) >= l.interval)
                .map(l => l.taskId);
            sleepTime = Math.min(sleepTime, ...Array.from(localTasks.values()).map(l => l.interval));
            const tasksResp = await api.call('dp-task/details', taskIds);
            const newHookTasks = new Map();
            Array.from(tasksResp.values()).forEach(t => {
                newHookTasks.set(t.id, t);
                if (t.status === DpTaskState.DONE
                    || t.status === DpTaskState.FAILED
                    || t.status === DpTaskState.CANCELLED
                ) {
                    localTasks.get(t.id).onUpdated(t);
                    try {
                        localTasks.get(t.id).onFinish(t);
                    } catch (e) {
                        console.error(e);
                    }
                    localTasks.delete(t.id);
                    updateMapping.delete(t.id);
                } else if (t.status === DpTaskState.INIT || t.status === DpTaskState.IN_PROGRESS) {
                    updateMapping.set(t.id, time);
                    localTasks.get(t.id).onUpdated(t);
                } else {
                    localTasks.delete(t.id);
                    updateMapping.delete(t.id);
                }
            });
            const temp = new Map(useDpTaskCenter.getState().tasks);
            newHookTasks.forEach((v, k) => {
                temp.set(k, v);
            });
            useDpTaskCenter.setState({ tasks: temp });
            await sleep(sleepTime);
            useDpTaskCenter.getState().listeners.forEach(l => {
                localTasks.set(l.taskId, l);
                updateMapping.set(l.taskId, 0);
                console.log('add tasks listener', l.taskId);
            });
            useDpTaskCenter.getState().listeners.splice(0);
        }
        console.log('end fetching tasks');
        running = false;
    }
);

export const getDpTask = async (taskId: number | null | undefined): Promise<DpTask> => {
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
    if (task.status !== DpTaskState.DONE) {
        return null;
    }
    try {
        if (isString) {
            return task.result as unknown as T;
        }
        return JSON.parse(task.result);
    } catch (e) {
        console.error(e);
        return null;
    }
};
export const registerDpTask = async (func: () => Promise<number>, config?: DpTaskConfig): Promise<number> => {
    return useDpTaskCenter.getState().register(func, config);
};
