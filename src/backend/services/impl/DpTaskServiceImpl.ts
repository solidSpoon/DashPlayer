import {eq, or} from 'drizzle-orm';
import db from '@/backend/db/db';
import {DpTask, dpTask, DpTaskState, InsertDpTask} from '@/backend/db/tables/dpTask';

import LRUCache from 'lru-cache';
import TimeUtil from '@/common/utils/TimeUtil';
import {inject, injectable, postConstruct} from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import dpLog from '@/backend/ioc/logger';
import {Cancelable} from '@/common/interfaces';

import {CancelByUserError} from '@/backend/errors/errors';
import TYPES from "@/backend/ioc/types";
import SystemService from "@/backend/services/SystemService";

@injectable()
export default class DpTaskServiceImpl implements DpTaskService {
    @inject(TYPES.SystemService) private systemService!: SystemService;
    private upQueue: Map<number, InsertDpTask> = new Map();
    private cancelQueue: Set<number> = new Set();
    private cache: LRUCache<number, InsertDpTask> = new LRUCache({
        maxSize: 2000,
        sizeCalculation: (value, key) => {
            return 1;
        }
    });
    private taskMapping: Map<number, Cancelable[]> = new Map();

    private notify(taskId: number) {
        // 调用你自己的 detail 方法获取最新数据
        this.detail(taskId)
            .then(task => {
                if (task) {
                    this.systemService.sendDpTaskUpdate(task);
                }
            })
    }

    public async detail(id: number): Promise<DpTask | null> {

        if (this.cache.has(id)) {
            console.log('temp task');
            return this.cache.get(id) as DpTask;
        }

        const tasks: DpTask[] = await db
            .select()
            .from(dpTask)
            .where(eq(dpTask.id, id));

        if (tasks.length === 0) {
            return null;
        }
        return tasks[0];
    }

    public async details(ids: number[]): Promise<Map<number, DpTask>> {
        const map = new Map<number, DpTask>();
        await Promise.all(ids.map(async id => {
                const task = await this.detail(id);
                if (task) {
                    map.set(id, task);
                }
            }
        ));
        return map;
    }


    public async create(): Promise<number> {
        const task: DpTask[] = await db
            .insert(dpTask)
            .values({
                status: DpTaskState.INIT,
                progress: '任务创建成功'
            }).returning();
        const taskId = task[0].id;
        this.cache.set(taskId, {
            id: taskId,
            status: DpTaskState.INIT,
            progress: '任务创建成功',
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        });
        this.notify(taskId);
        return taskId;
    }


    public update(
        task: InsertDpTask
    ) {
        if (task.id === undefined || task.id === null) {
            return;
        }
        if (this.cache.has(task.id)) {
            this.cache.set(task.id, {
                ...this.cache.get(task.id),
                ...task,
                updated_at: TimeUtil.timeUtc()
            });
        }
        this.upQueue.set(task.id, {
            ...task,
            updated_at: TimeUtil.timeUtc()
        });
        this.notify(task.id);
    }

    public process(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.IN_PROGRESS,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    public finish(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.DONE,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    public fail(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.FAILED,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    private updateTaskInfo(task: InsertDpTask, info: InsertDpTask) {
        if (info.progress !== undefined) {
            dpLog.info(`task ${task.id} progress: ${info.progress}`);
            task.progress = info.progress;
        }
        if (info.result !== undefined) {
            dpLog.info(`task ${task.id} result: ${info.result}`);
            task.result = info.result;
        }
    }

    cancel(id: number) {
        this.cancelQueue.add(id);
        const cancelable = this.taskMapping.get(id);
        if (cancelable) {
            cancelable.forEach(c => {
                c.cancel();
            });
        }
    }

    checkCancel(id: number) {
        if (this.cancelQueue.has(id)) {
            this.update({
                id,
                status: DpTaskState.CANCELLED,
                progress: '任务取消'
            });
            throw new CancelByUserError();
        }
    }

    @postConstruct()
    public postConstruct() {
        setInterval(async () => {
            if (this.upQueue.size > 0) {
                for (const [key, value] of this.upQueue) {
                    await db
                        .update(dpTask)
                        .set({
                            ...value,
                            updated_at: TimeUtil.timeUtc()
                        })
                        .where(eq(dpTask.id, key));
                    this.upQueue.delete(key);
                }
            }
        }, 3000);
    }

    public static async cancelAll() {
        await db
            .update(dpTask)
            .set({
                status: DpTaskState.CANCELLED,
                progress: '任务取消',
                updated_at: TimeUtil.timeUtc()
            })
            .where(or(eq(dpTask.status, DpTaskState.INIT), eq(dpTask.status, DpTaskState.IN_PROGRESS)));
    }

    public registerTask(taskId: number, process: Cancelable) {
        const existingProcesses = this.taskMapping.get(taskId) || [];
        this.taskMapping.set(taskId, [...existingProcesses, process]);
        if (this.cancelQueue.has(taskId)) {
            process.cancel();
        }
    }

}
