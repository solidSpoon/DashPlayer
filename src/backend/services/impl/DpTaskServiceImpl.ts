import { getMainLogger } from '@/backend/ioc/simple-logger';
import { DpTask, DpTaskState, InsertDpTask } from '@/backend/infrastructure/db/tables/dpTask';

import { LRUCache } from 'lru-cache';
import TimeUtil from '@/common/utils/TimeUtil';
import {inject, injectable, postConstruct} from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import {Cancelable} from '@/common/interfaces';

import {CancelByUserError} from '@/backend/errors/errors';
import TYPES from "@/backend/ioc/types";
import DpTaskRepository from '@/backend/infrastructure/db/repositories/DpTaskRepository';
import RendererEvents from '@/backend/services/RendererEvents';

@injectable()
export default class DpTaskServiceImpl implements DpTaskService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.DpTaskRepository) private dpTaskRepository!: DpTaskRepository;
    private logger = getMainLogger('DpTaskServiceImpl');
    private upQueue: Map<number, InsertDpTask> = new Map();
    private cancelQueue: Set<number> = new Set();
    private cache: LRUCache<number, InsertDpTask> = new LRUCache({
        maxSize: 2000,
        sizeCalculation: () => {
            return 1;
        }
    });
    private taskMapping: Map<number, Cancelable[]> = new Map();

    private notify(taskId: number) {
        // 调用你自己的 detail 方法获取最新数据
        this.detail(taskId)
            .then(task => {
                if (task) {
                    this.rendererEvents.dpTaskUpdate(task);
                }
            })
    }

    public async detail(id: number): Promise<DpTask | null> {

        if (this.cache.has(id)) {
            this.logger.debug('returning cached task', { taskId: id });
            return this.cache.get(id) as DpTask;
        }

        return await this.dpTaskRepository.findById(id);
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
        const task = await this.dpTaskRepository.create({
            status: DpTaskState.INIT,
            progress: '任务创建成功',
        });
        const taskId = task.id;
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
            this.logger.info('task progress updated', { taskId: task.id, progress: info.progress });
            task.progress = info.progress;
        }
        if (info.result !== undefined) {
            this.logger.info('task result updated', { taskId: task.id, result: info.result });
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
                    await this.dpTaskRepository.updateById(key, {
                        ...value,
                        updated_at: TimeUtil.timeUtc(),
                    });
                    this.upQueue.delete(key);
                }
            }
        }, 3000);
    }

    /**
     * 应用重启时取消所有任务
     */
    public static async cancelAll() {
        const { default: DpTaskRepositoryImpl } = await import('@/backend/infrastructure/db/repositories/impl/DpTaskRepositoryImpl');
        const repo = new DpTaskRepositoryImpl();
        await repo.cancelAllActive();
    }

    public registerTask(taskId: number, process: Cancelable) {
        const existingProcesses = this.taskMapping.get(taskId) || [];
        this.taskMapping.set(taskId, [...existingProcesses, process]);
        if (this.cancelQueue.has(taskId)) {
            process.cancel();
        }
    }

}
