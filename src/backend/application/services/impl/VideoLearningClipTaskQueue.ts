import { concurrency } from '@/backend/application/kernel/concurrency';

/**
 * 视频学习片段队列中的裁切任务。
 */
export type LearningClipTask = {
    /** 源视频绝对路径。 */
    videoPath: string;
    /** 字幕缓存键。 */
    srtKey: string;
    /** 目标字幕行序号。 */
    indexInSrt: number;
    /** 当前片段命中的单词列表。 */
    matchedWords: string[];
    /** 用于去重的稳定片段键。 */
    clipKey: string;
    /** 字幕文件绝对路径，用于缓存缺失时重新加载。 */
    srtPath?: string;
};

/**
 * 单个裁切任务结束后的队列状态。
 */
export type LearningClipTaskResult = {
    /** 刚刚结束的任务。 */
    task: LearningClipTask;
    /** 执行失败时的原始异常。 */
    error?: unknown;
};

/**
 * 队列执行所需的业务回调。
 */
type VideoLearningClipTaskQueueOptions = {
    /** 执行单个裁切任务。 */
    execute: (task: LearningClipTask) => Promise<void>;
    /** 单个任务结束后同步业务状态。 */
    onTaskFinished: (result: LearningClipTaskResult) => Promise<void>;
    /** 队列消费循环出现非任务异常时显式报告。 */
    onQueueError: (error: unknown) => void;
};

/**
 * 被取消的等待任务摘要。
 */
export type CancelledLearningClipTasks = {
    /** 实际取消的等待任务数量。 */
    count: number;
    /** 受影响的字幕缓存键。 */
    srtKeys: Set<string>;
};

/**
 * 管理视频学习片段的等待队列和串行消费。
 *
 * 队列只负责任务状态与消费顺序，不感知字幕、ffmpeg、OSS、数据库或界面通知。
 * 已经开始执行的任务不会被取消，批量取消只移除尚未开始的等待任务。
 */
export default class VideoLearningClipTaskQueue {
    /** 尚未开始执行的任务，按加入顺序消费。 */
    private readonly pendingTasks = new Map<string, LearningClipTask>();
    /** 当前正在执行的任务。 */
    private activeTask?: LearningClipTask;
    /** 当前是否已有消费循环在运行。 */
    private isDraining = false;

    /**
     * 创建视频学习片段任务队列。
     *
     * @param options 单任务执行和状态通知回调。
     */
    public constructor(private readonly options: VideoLearningClipTaskQueueOptions) {}

    /**
     * 将未重复的裁切任务加入等待队列。
     *
     * 当前正在执行或已经等待的同键任务会被忽略，调用方需要显式调用 start 开始消费。
     *
     * @param tasks 待加入的裁切任务。
     * @returns 实际加入队列的任务数。
     */
    public enqueue(tasks: LearningClipTask[]): number {
        let addedCount = 0;
        for (const task of tasks) {
            if (this.activeTask?.clipKey === task.clipKey || this.pendingTasks.has(task.clipKey)) {
                continue;
            }
            this.pendingTasks.set(task.clipKey, task);
            addedCount++;
        }
        return addedCount;
    }

    /**
     * 启动队列消费。
     *
     * 已有消费循环时直接返回；消费过程中加入的新任务会被同一循环继续处理。
     */
    public start(): void {
        if (this.isDraining || this.pendingTasks.size === 0) {
            return;
        }

        this.isDraining = true;
        void this.drain();
    }

    /**
     * 返回当前正在执行和等待中的全部任务。
     *
     * @returns 以当前执行任务开头的只读快照。
     */
    public getTasks(): LearningClipTask[] {
        return [
            ...(this.activeTask ? [this.activeTask] : []),
            ...this.pendingTasks.values(),
        ];
    }

    /**
     * 返回指定字幕正在执行和等待中的任务。
     *
     * @param srtKey 字幕缓存键。
     * @returns 对应字幕的任务快照。
     */
    public getTasksBySrt(srtKey: string): LearningClipTask[] {
        return this.getTasks().filter((task) => task.srtKey === srtKey);
    }

    /**
     * 统计当前正在执行和等待中的任务总数。
     *
     * @returns 队列任务总数。
     */
    public getTaskCount(): number {
        return this.pendingTasks.size + (this.activeTask ? 1 : 0);
    }

    /**
     * 清空尚未开始执行的任务。
     *
     * 当前正在执行的任务会自然完成，不计入取消数量。
     *
     * @returns 被取消的任务数量和受影响字幕。
     */
    public cancelPendingTasks(): CancelledLearningClipTasks {
        const srtKeys = new Set<string>();
        for (const task of this.pendingTasks.values()) {
            srtKeys.add(task.srtKey);
        }

        const count = this.pendingTasks.size;
        this.pendingTasks.clear();
        return { count, srtKeys };
    }

    /**
     * 顺序消费全部等待任务。
     *
     * 消费循环异常会交给调用方报告；只要仍有等待任务，循环会重新启动。
     */
    private async drain(): Promise<void> {
        try {
            while (await this.processNextTask()) {
                // 返回值已经表达是否取得任务，无需轮询或额外等待。
            }
        } catch (error) {
            this.options.onQueueError(error);
        } finally {
            this.isDraining = false;
            if (this.pendingTasks.size > 0) {
                this.start();
            }
        }
    }

    /**
     * 取得并执行队首任务。
     *
     * 单个任务的核心写操作使用视频学习同步锁保护，状态通知不占用锁。
     *
     * @returns 实际取得任务时返回 true。
     */
    private async processNextTask(): Promise<boolean> {
        const task = this.pendingTasks.values().next().value as LearningClipTask | undefined;
        if (!task) {
            return false;
        }

        this.pendingTasks.delete(task.clipKey);
        this.activeTask = task;

        let error: unknown;
        try {
            await concurrency.withMutex('video-learning-sync', async () => {
                await this.options.execute(task);
            });
        } catch (cause) {
            error = cause;
        } finally {
            this.activeTask = undefined;
        }

        await this.options.onTaskFinished({
            task,
            error,
        });
        return true;
    }
}
