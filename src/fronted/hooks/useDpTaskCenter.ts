import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import FileT, {FileType} from '../../common/types/FileT';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import {sleep} from "@/common/utils/Util";

const api = window.electron;

export interface Listener {
    taskId: number;
    onFinish: (task: DpTask) => void;
    createAt: number;
    interval: number;
}

const updateMapping = new Map<number, number>();
const finished = new Set<number>();


type UseDpTaskCenterState = {
    listeners: Listener[];
    tasks: Map<number, DpTask>;
};

type UseDpTaskCenterStateAction = {
    register(func: () => Promise<number>, config?: {
        interval?: number;
        onFinish?: (task: DpTask) => void;
    }): Promise<number>;
    tryRegister(taskId: number): void;
};

const useDpTaskCenter = create(
    subscribeWithSelector<UseDpTaskCenterState & UseDpTaskCenterStateAction>((set, get) => ({
        listeners: [],
        tasks: new Map(),
        register: async (func, config) => {
            const taskId = await func();
            const newListeners = [...get().listeners
                .filter(l => l.taskId !== taskId)
                .filter(l => !finished.has(l.taskId))
            ];
            const time = new Date().getTime();
            newListeners.push({
                taskId,
                onFinish: config?.onFinish ?? (() => {
                }),
                interval: config?.interval ?? 1000,
                createAt: time,
            });
            updateMapping.set(taskId, time);
            console.log('register', taskId, newListeners);
            set({listeners: newListeners});
            return taskId;
        },
        tryRegister(taskId: number) {
            const listener = get().listeners.find(l => l.taskId === taskId);
            if (!listener) {
                get().register(async () => taskId);
            }
        }
    }))
);

export default useDpTaskCenter;

const filterRecent = (listeners: Listener[], filterTime: number) => {
    // 10 分钟之内的
    return listeners
        .filter(l => !finished.has(l.taskId))
        .filter(l => l.createAt <= filterTime)
        .filter(l => l.createAt > filterTime - 10 * 60 * 1000);
}

let running = false;
useDpTaskCenter.subscribe(
    (s) => s.listeners,
    async (listeners) => {
        console.log('try start fetching tasks');
        if (running) return;
        running = true;
        console.log('start fetching tasks');
        let filterTime = new Date().getTime();
        let ls = filterRecent(listeners, filterTime);
        while (ls.length > 0) {
            console.log('fetching tasks');
            let currentLs = [...ls];
            let sleepTime = 1000;
            for (const l of currentLs) {
                sleepTime = Math.min(sleepTime, l.interval);
            }
            const now = new Date().getTime();
            currentLs = currentLs.filter(l => now - updateMapping.get(l.taskId) >= l.interval);
            if (currentLs.length === 0) {
                await sleep(sleepTime);
                continue;
            }
            const taskIds = currentLs.map(l => l.taskId);
            const tasksResp = await api.call('dp-task/details', taskIds);
            const newRes = new Map<number, DpTask>(useDpTaskCenter.getState().tasks);
            tasksResp.forEach(t => {
                newRes.set(t.id, t);
                updateMapping.set(t.id, now);
            });
            useDpTaskCenter.setState({tasks: newRes});
            for (const l of currentLs) {
                const status = tasksResp.get(l.taskId)?.status;
                if (status === DpTaskState.DONE) {
                    l.onFinish?.(tasksResp.get(l.taskId));
                    finished.add(l.taskId);
                } else if (status === DpTaskState.INIT || status === DpTaskState.IN_PROGRESS) {
                    ls.push(l);
                }
            }
            await sleep(sleepTime);
            const newLs = filterRecent(useDpTaskCenter.getState().listeners, filterTime)
                .filter(l => l.createAt > filterTime);
            ls = ls.filter(l => !currentLs.includes(l));
            ls = ls.concat(newLs);
            filterTime = now;
        }
        console.log('end fetching tasks');
        running = false;
    }
);
