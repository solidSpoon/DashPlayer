import { getMainLogger } from '@/backend/infrastructure/logger';
import { DpTask, DpTaskState, InsertDpTask } from '@/backend/infrastructure/db/tables/dpTask';

import { LRUCache } from 'lru-cache';
import TimeUtil from '@/common/utils/TimeUtil';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/application/services/DpTaskService';
import { Cancelable } from '@/common/interfaces';

import { CancelByUserError } from '@/backend/application/errors/errors';
import TYPES from '@/backend/ioc/types';
import DpTaskRepository, { DpTaskUpdatePatch } from '@/backend/application/ports/repositories/DpTaskRepository';
import RendererEvents from '@/backend/application/ports/gateways/renderer/RendererEvents';

/**
 * 尚未落库的任务更新。
 *
 * 同一任务的多次更新按调用顺序合并，后一次字段覆盖前一次字段。
 */
type PendingTaskUpdate = DpTaskUpdatePatch;

@injectable()
export default class DpTaskServiceImpl implements DpTaskService {
    @inject(TYPES.RendererEvents) private rendererEvents!: RendererEvents;
    @inject(TYPES.DpTaskRepository) private dpTaskRepository!: DpTaskRepository;
    private logger = getMainLogger('DpTaskServiceImpl');
    /** 等待合并落库的任务更新。 */
    private readonly pendingUpdates = new Map<number, PendingTaskUpdate>();
    /** 当前是否已有落库消费者在执行。 */
    private isFlushingUpdates = false;
    /** 当前刷写结束后是否需要立即处理新到达的结束状态。 */
    private shouldFlushImmediately = false;
    /** 普通进度更新的合并等待计时器。 */
    private flushTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly cancelQueue = new Set<number>();
    private readonly cache: LRUCache<number, InsertDpTask> = new LRUCache({
        maxSize: 2000,
        sizeCalculation: () => {
            return 1;
        }
    });
    private readonly taskMapping = new Map<number, Cancelable[]>();

    /**
     * 将任务最新状态通知给渲染进程。
     *
     * @param taskId 任务编号。
     */
    private notify(taskId: number): void {
        this.detail(taskId)
            .then(task => {
                if (task) {
                    this.rendererEvents.dpTaskUpdate(task);
                }
            });
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


    /**
     * 合并任务更新，并按状态决定延迟或立即写入数据库。
     *
     * @param task 本次需要更新的字段，必须包含任务编号。
     */
    public update(task: InsertDpTask): void {
        if (task.id === undefined || task.id === null) {
            return;
        }
        const updatedTask = {
            ...task,
            updated_at: TimeUtil.timeUtc(),
        };
        if (this.cache.has(task.id)) {
            this.cache.set(task.id, {
                ...this.cache.get(task.id),
                ...updatedTask,
            });
        }
        this.mergePendingUpdate(task.id, updatedTask);
        this.scheduleUpdateFlush(this.isFinalState(task.status));
        this.notify(task.id);
    }

    /**
     * 标记任务进入处理中状态。
     *
     * @param id 任务编号。
     * @param info 进度或结果补充信息。
     */
    public process(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.IN_PROGRESS,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    /**
     * 标记任务成功完成。
     *
     * @param id 任务编号。
     * @param info 最终进度或结果。
     */
    public finish(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.DONE,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
        // 最终结果只在这一行完整记录（日志系统会按单行 800 字上限兜底），逐 chunk 更新不记。
        this.logger.info('task finished', { taskId: id, result: info.result ?? null });
    }

    /**
     * 标记任务执行失败。
     *
     * @param id 任务编号。
     * @param info 失败结果或进度说明。
     */
    public fail(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.FAILED,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
        this.logger.info('task failed', { taskId: id, result: info.result ?? null });
    }

    /**
     * 将调用方提供的进度和结果写入任务更新对象。
     *
     * @param task 将被更新的任务。
     * @param info 调用方提供的补充字段。
     */
    private updateTaskInfo(task: InsertDpTask, info: InsertDpTask): void {
        if (info.progress !== undefined) {
            // 进度更新频率高，降为 debug 避免刷屏。
            this.logger.debug('task progress updated', { taskId: task.id, progress: info.progress });
            task.progress = info.progress;
        }
        if (info.result !== undefined) {
            task.result = info.result;
        }
    }

    /**
     * 请求取消任务及其已注册的可取消操作。
     *
     * @param id 任务编号。
     */
    public cancel(id: number): void {
        this.logger.info('task cancel requested', { taskId: id });
        this.cancelQueue.add(id);
        const cancelable = this.taskMapping.get(id);
        if (cancelable) {
            cancelable.forEach(c => {
                c.cancel();
            });
        }
    }

    /**
     * 在任务执行过程中检查是否已收到取消请求。
     *
     * @param id 任务编号。
     * @throws {CancelByUserError} 用户已取消任务时抛出。
     */
    public checkCancel(id: number): void {
        if (this.cancelQueue.has(id)) {
            this.logger.info('task cancel confirmed', { taskId: id });
            this.update({
                id,
                status: DpTaskState.CANCELLED,
                progress: '任务取消'
            });
            throw new CancelByUserError();
        }
    }

    /**
     * 合并同一任务的待落库字段。
     *
     * @param taskId 任务编号。
     * @param update 待合并字段。
     */
    private mergePendingUpdate(taskId: number, update: PendingTaskUpdate): void {
        this.pendingUpdates.set(taskId, {
            ...this.pendingUpdates.get(taskId),
            ...update,
        });
    }

    /**
     * 判断任务状态是否需要立即持久化。
     *
     * @param state 待判断的数据库任务状态。
     * @returns 任务结束状态时返回 `true`。
     */
    private isFinalState(state: string | undefined): boolean {
        return state === DpTaskState.DONE
            || state === DpTaskState.FAILED
            || state === DpTaskState.CANCELLED;
    }

    /**
     * 安排一次合并后的任务状态落库。
     *
     * 结束状态立即请求刷写；普通进度更新只等待短暂时间以合并高频调用。
     *
     * @param immediately 是否跳过等待立即刷写。
     */
    private scheduleUpdateFlush(immediately = false): void {
        if (this.isFlushingUpdates) {
            this.shouldFlushImmediately = this.shouldFlushImmediately || immediately;
            return;
        }
        if (immediately) {
            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = undefined;
            }
            void this.flushPendingUpdates();
            return;
        }
        if (this.isFlushingUpdates || this.flushTimer) {
            return;
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = undefined;
            void this.flushPendingUpdates();
        }, 300);
    }

    /**
     * 顺序写入当前待处理更新。
     *
     * 刷写期间新到达的更新保留在原队列中；写入失败的项目会合并回队列并在稍后重试。
     */
    private async flushPendingUpdates(): Promise<void> {
        if (this.isFlushingUpdates || this.pendingUpdates.size === 0) {
            return;
        }

        this.isFlushingUpdates = true;
        const updates = Array.from(this.pendingUpdates.entries());
        this.pendingUpdates.clear();

        try {
            for (let index = 0; index < updates.length; index++) {
                const [taskId, update] = updates[index];
                try {
                    await this.dpTaskRepository.updateById(taskId, update);
                } catch (error) {
                    this.mergePendingUpdate(taskId, update);
                    for (const [remainingTaskId, remainingUpdate] of updates.slice(index + 1)) {
                        this.mergePendingUpdate(remainingTaskId, remainingUpdate);
                    }
                    this.logger.error('任务状态写入失败，将在稍后重试', { taskId, error });
                    return;
                }
            }
        } finally {
            this.isFlushingUpdates = false;
            if (this.pendingUpdates.size > 0) {
                const immediately = this.shouldFlushImmediately;
                this.shouldFlushImmediately = false;
                this.scheduleUpdateFlush(immediately);
            }
        }
    }

    /**
     * 应用启动时取消数据库中遗留的活动任务。
     */
    public static async cancelAll(): Promise<void> {
        getMainLogger('DpTaskServiceImpl').info('cancel all active tasks on startup');
        const { default: DpTaskRepositoryImpl } = await import('@/backend/infrastructure/db/repositories/DpTaskRepositoryImpl');
        const repo = new DpTaskRepositoryImpl();
        await repo.cancelAllActive();
    }

    /**
     * 注册与任务生命周期绑定的可取消操作。
     *
     * 已收到取消请求的任务会立即取消新注册的操作。
     *
     * @param taskId 任务编号。
     * @param process 可取消操作。
     */
    public registerTask(taskId: number, process: Cancelable): void {
        const existingProcesses = this.taskMapping.get(taskId) || [];
        this.taskMapping.set(taskId, [...existingProcesses, process]);
        if (this.cancelQueue.has(taskId)) {
            process.cancel();
        }
    }

}
