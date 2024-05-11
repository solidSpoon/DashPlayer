import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import {emptyFunc, sleep} from '@/common/utils/Util';

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

type UseDpTaskCenterStateAction = {
    register(func: () => Promise<number>, config?: {
        interval?: number;
        onFinish?: (task: DpTask) => void;
        onUpdated?: (task: DpTask) => void;
    }): Promise<number>;
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
                if (t.status === DpTaskState.DONE) {
                    localTasks.get(t.id).onUpdated(t);
                    try {
                        localTasks.get(t.id).onFinish(t)
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
