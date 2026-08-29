const SUBTITLE_BATCH_SIZE = 5;
const SUBTITLE_WINDOW_BATCH_COUNT = 4;
const SUBTITLE_WINDOW_BATCH_BEFORE_COUNT = 1;
const HIGH_PRIORITY_BATCH_COUNT = 2;
const MAX_CONSUMERS = 4;
const MAX_REQUEUE_COUNT = 2;

export type SubtitleTranslationPriority = 'high' | 'low';

/**
 * 单次字幕翻译批次的执行结果。
 */
export interface SubtitleTranslationBatchResult {
    /** 已经成功处理或命中缓存的字幕索引。 */
    completedIndices: number[];
    /** 本次执行后仍然失败的字幕索引。 */
    failedIndices: number[];
    /** 是否因为会话切换或跳转而主动取消。 */
    cancelled: boolean;
}

/**
 * 调度器提交给翻译执行器的批次参数。
 */
export interface SubtitleTranslationBatchRequest<TContext> {
    /** 字幕文件哈希。 */
    fileHash: string;
    /** 用于串联一次批次生命周期日志的稳定编号。 */
    batchId: string;
    /** 当前批次目标字幕索引；同一批次内不会与其他运行批次重叠。 */
    indices: number[];
    /** 当前需求标记。 */
    demandId: number;
    /** 当前批次相对于播放位置的优先级。 */
    priority: SubtitleTranslationPriority;
    /** 该任务已经重新入队的次数。 */
    requeueCount: number;
    /** 当前翻译配置上下文。 */
    context: TContext;
    /** 用于取消过期请求的信号。 */
    signal: AbortSignal;
}

/**
 * 调度器发出的字幕批次生命周期事件。
 */
export type SubtitleTranslationBatchLifecycleEvent<TContext> = Omit<
    SubtitleTranslationBatchRequest<TContext>,
    'signal'
>;

/**
 * 字幕翻译需求更新参数。
 */
export interface SubtitleTranslationDemand<TContext> {
    /** 字幕文件哈希。 */
    fileHash: string;
    /**
     * 当前正在播放的字幕稳定坐标（sentence.index）。
     * 增量转录会话中坐标为「分片序号 × 100000 + 片内序号」，与数组下标不同。
     */
    currentIndex: number;
    /** 前端按播放位置递增的需求标记。 */
    demandId: number;
    /** 发起需求的 renderer 进程会话标识。 */
    rendererSessionId: string;
    /**
     * 当前全部字幕的稳定坐标，按升序排列。
     * 调度器按坐标划分批次，因此坐标稀疏（例如增量转录的跨分片间隔）时批次自然缩小，不会跨分片拼批。
     */
    sentenceIndices: number[];
    /** 标识翻译引擎、模式和提示词版本的稳定键。 */
    profileKey: string;
    /** 当前翻译配置上下文。 */
    context: TContext;
}

/**
 * 字幕翻译调度器配置。
 */
export interface SubtitleTranslationSchedulerOptions<TContext> {
    /**
     * 执行一个固定大小的字幕批次。
     *
     * @param request 当前批次参数。
     * @returns 本批次成功、失败和取消状态。
     */
    executeBatch: (
        request: SubtitleTranslationBatchRequest<TContext>
    ) => Promise<SubtitleTranslationBatchResult>;
    /**
     * 执行器意外抛出未归一化异常时的观测回调。
     *
     * @param error 原始异常。
     * @param request 触发异常的批次参数。
     */
    onBatchError?: (
        error: unknown,
        request: SubtitleTranslationBatchLifecycleEvent<TContext>
    ) => void;
    /**
     * 批次失败后重新进入当前窗口队列时触发。
     *
     * @param request 即将重试的批次参数。
     */
    onBatchRequeued?: (
        request: SubtitleTranslationBatchLifecycleEvent<TContext>
    ) => void;
    /**
     * 批次超过最大重试次数并进入死信状态时触发。
     *
     * @param request 最后一次执行的批次参数。
     */
    onBatchDeadLetter?: (
        request: SubtitleTranslationBatchLifecycleEvent<TContext>
    ) => void;
    /**
     * 批次失败后已经离开当前播放窗口、不再重试时触发。
     *
     * @param request 最后一次执行的批次参数。
     */
    onBatchDropped?: (
        request: SubtitleTranslationBatchLifecycleEvent<TContext>
    ) => void;
}

interface SubtitleTranslationJob<TContext> {
    /** 用于串联一次批次生命周期日志的稳定编号。 */
    batchId: string;
    /** 该批次在坐标空间中的起始坐标。 */
    batchStart: number;
    /** 当前任务需要处理的句子稳定坐标。 */
    indices: number[];
    /** 当前批次相对于播放位置的优先级。 */
    priority: SubtitleTranslationPriority;
    /** 该任务已经重新入队的次数。 */
    requeueCount: number;
    /** 当前任务使用的翻译上下文。 */
    context: TContext;
    /** 当前执行请求的取消控制器。 */
    controller?: AbortController;
}

/**
 * 单个字幕文件在内存中的翻译窗口会话。
 */
interface SubtitleTranslationSession<TContext> {
    /** 字幕文件哈希。 */
    fileHash: string;
    /** 当前翻译配置版本。 */
    profileKey: string;
    /** 当前翻译需求标记。 */
    demandId: number;
    /** 当前需求所属的 renderer 进程会话标识。 */
    rendererSessionId: string;
    /** 当前翻译配置上下文。 */
    context: TContext;
    /** 当前播放字幕稳定坐标。 */
    currentIndex: number;
    /** 当前全部字幕的稳定坐标，按升序排列。 */
    sentenceIndices: number[];
    /** 当前窗口起始批次（坐标空间）。 */
    currentBatchStart: number;
    /** 已完成的字幕稳定坐标。 */
    completedIndices: Set<number>;
    /** 在本次会话中已经进入死信状态的字幕稳定坐标。 */
    deadIndices: Set<number>;
    /** 已经分配给运行任务的字幕稳定坐标。 */
    inFlightIndices: Set<number>;
    /** 当前有效窗口中已经创建过的批次起点。 */
    knownBatchStarts: Set<number>;
    /** 等待消费者认领的任务。 */
    pendingJobs: SubtitleTranslationJob<TContext>[];
    /** 正在被消费者执行的任务。 */
    runningJobs: Map<string, SubtitleTranslationJob<TContext>>;
}

/**
 * 围绕当前播放位置维护有界翻译窗口的调度器。
 *
 * 调度器不是先进先出队列，也没有常驻循环：
 * 每次需求更新或任务完成时，按照距离播放位置的优先级启动最多三个消费者。
 */
export default class SubtitleTranslationScheduler<TContext> {
    private readonly sessions = new Map<string, SubtitleTranslationSession<TContext>>();

    private nextBatchId = 1;

    /**
     * 创建字幕翻译调度器。
     *
     * @param options 批次执行回调。
     */
    public constructor(
        private readonly options: SubtitleTranslationSchedulerOptions<TContext>
    ) {}

    /**
     * 更新播放位置并重建当前有效翻译窗口。
     *
     * 前一批次、当前批次、下一批次和下下批次组成窗口；当前批次和下一批次为高优先级，前一批次与下下批次为低优先级。
     * 需求标记倒退时直接忽略，避免异步 IPC 返回顺序导致播放位置回退。
     * 窗口按稳定坐标计算：增量转录会话的坐标存在跨分片间隔，批次会自然缩小而不跨分片拼批。
     *
     * @param demand 当前字幕翻译需求。
     */
    public updateDemand(demand: SubtitleTranslationDemand<TContext>): void {
        if (demand.sentenceIndices.length === 0) {
            this.release(demand.fileHash, demand.rendererSessionId);
            return;
        }

        // 坐标钳制到现有字幕范围内；普通 SRT 的坐标即 0..N-1，与旧数组下标语义一致。
        const lastIndex = demand.sentenceIndices[demand.sentenceIndices.length - 1];
        const currentIndex = Math.max(
            demand.sentenceIndices[0],
            Math.min(demand.currentIndex, lastIndex)
        );
        const existing = this.sessions.get(demand.fileHash);

        // 同一 renderer 会话内按数字防止异步请求回退；新 renderer 会话需要重置游标。
        if (
            existing
            && demand.rendererSessionId === existing.rendererSessionId
            && demand.demandId <= existing.demandId
        ) {
            return;
        }

        if (
            !existing
            || existing.profileKey !== demand.profileKey
            || existing.rendererSessionId !== demand.rendererSessionId
        ) {
            if (existing) {
                this.abortSession(existing);
            }
            const session = this.createSession(demand, currentIndex);
            this.sessions.set(demand.fileHash, session);
            this.refreshWindow(session);
            this.schedule(session);
            return;
        }

        existing.demandId = demand.demandId;
        existing.rendererSessionId = demand.rendererSessionId;
        existing.currentIndex = currentIndex;
        existing.sentenceIndices = demand.sentenceIndices;
        existing.context = demand.context;
        existing.currentBatchStart = this.getBatchStart(currentIndex);
        this.refreshWindow(existing);
        this.schedule(existing);
    }

    /**
     * 释放指定字幕文件的翻译会话并取消仍在执行的请求。
     *
     * @param fileHash 字幕文件哈希。
     * @param rendererSessionId 仅释放对应 renderer 会话，避免旧窗口误删新会话。
     */
    public release(fileHash: string, rendererSessionId?: string): void {
        const session = this.sessions.get(fileHash);
        if (!session) {
            return;
        }
        if (rendererSessionId && session.rendererSessionId !== rendererSessionId) {
            return;
        }
        this.sessions.delete(fileHash);
        this.abortSession(session);
        session.pendingJobs.length = 0;
    }

    /**
     * 创建新的字幕翻译会话。
     *
     * @param demand 当前字幕翻译需求。
     * @param currentIndex 已校正到有效范围的当前索引。
     * @returns 新建的内存会话。
     */
    private createSession(
        demand: SubtitleTranslationDemand<TContext>,
        currentIndex: number
    ): SubtitleTranslationSession<TContext> {
        return {
            fileHash: demand.fileHash,
            profileKey: demand.profileKey,
            demandId: demand.demandId,
            rendererSessionId: demand.rendererSessionId,
            context: demand.context,
            currentIndex,
            sentenceIndices: demand.sentenceIndices,
            currentBatchStart: this.getBatchStart(currentIndex),
            completedIndices: new Set(),
            deadIndices: new Set(),
            inFlightIndices: new Set(),
            knownBatchStarts: new Set(),
            pendingJobs: [],
            runningJobs: new Map(),
        };
    }

    /**
     * 根据当前位置创建或更新固定范围内的批次。
     *
     * @param session 当前字幕翻译会话。
     */
    private refreshWindow(session: SubtitleTranslationSession<TContext>): void {
        const desiredBatchStarts = new Set<number>();
        for (
            let offset = -SUBTITLE_WINDOW_BATCH_BEFORE_COUNT;
            offset < SUBTITLE_WINDOW_BATCH_COUNT - SUBTITLE_WINDOW_BATCH_BEFORE_COUNT;
            offset += 1
        ) {
            const batchStart = session.currentBatchStart + offset * SUBTITLE_BATCH_SIZE;
            // 仅保留坐标区间内实际存在字幕的批次；坐标稀疏时空批次被自然跳过。
            if (batchStart >= 0 && this.getBatchIndices(session, batchStart).length > 0) {
                desiredBatchStarts.add(batchStart);
            }
        }

        session.pendingJobs = session.pendingJobs.filter((job) =>
            desiredBatchStarts.has(job.batchStart)
        );

        desiredBatchStarts.forEach((batchStart) => {
            const priority = this.getPriority(
                batchStart,
                session.currentBatchStart
            );
            const pendingJob = session.pendingJobs.find((job) => job.batchStart === batchStart);
            if (pendingJob) {
                pendingJob.priority = priority;
                pendingJob.context = session.context;
                return;
            }

            const runningJob = Array.from(session.runningJobs.values())
                .find((job) => job.batchStart === batchStart);
            if (runningJob) {
                return;
            }

            if (session.knownBatchStarts.has(batchStart)) {
                return;
            }

            const indices = this.getBatchIndices(session, batchStart)
                .filter((index) =>
                    !session.completedIndices.has(index)
                    && !session.deadIndices.has(index)
                    && !session.inFlightIndices.has(index)
                );
            if (indices.length === 0) {
                session.knownBatchStarts.add(batchStart);
                return;
            }

            session.knownBatchStarts.add(batchStart);
            session.pendingJobs.push({
                batchId: this.createBatchId(session.fileHash),
                batchStart,
                indices,
                priority,
                requeueCount: 0,
                context: session.context,
            });
        });

        const activeBatchStarts = new Set([
            ...session.pendingJobs.map((job) => job.batchStart),
            ...Array.from(session.runningJobs.values()).map((job) => job.batchStart),
        ]);
        session.knownBatchStarts.forEach((batchStart) => {
            if (!desiredBatchStarts.has(batchStart) && !activeBatchStarts.has(batchStart)) {
                session.knownBatchStarts.delete(batchStart);
            }
        });
    }

    /**
     * 在消费者空闲时按优先级启动最多三个批次。
     *
     * @param session 当前字幕翻译会话。
     */
    private schedule(session: SubtitleTranslationSession<TContext>): void {
        if (this.sessions.get(session.fileHash) !== session) {
            return;
        }

        while (session.runningJobs.size < MAX_CONSUMERS) {
            const job = this.takeNextPendingJob(session);
            if (!job) {
                return;
            }
            this.startJob(session, job);
        }
    }

    /**
     * 从当前有效窗口中认领最高优先级的未执行批次。
     *
     * @param session 当前字幕翻译会话。
     * @returns 被认领的批次；没有可执行批次时返回 undefined。
     */
    private takeNextPendingJob(
        session: SubtitleTranslationSession<TContext>
    ): SubtitleTranslationJob<TContext> | undefined {
        session.pendingJobs.sort((left, right) => {
            const priorityDifference = this.priorityRank(right.priority)
                - this.priorityRank(left.priority);
            if (priorityDifference !== 0) {
                return priorityDifference;
            }
            return left.batchStart - right.batchStart;
        });

        const job = session.pendingJobs.shift();
        if (!job) {
            return undefined;
        }

        const availableIndices = job.indices.filter((index) =>
            !session.completedIndices.has(index)
            && !session.deadIndices.has(index)
            && !session.inFlightIndices.has(index)
        );
        if (availableIndices.length === 0) {
            return this.takeNextPendingJob(session);
        }

        job.indices = availableIndices;
        job.priority = this.getPriority(job.batchStart, session.currentBatchStart);
        session.runningJobs.set(job.batchId, job);
        job.indices.forEach((index) => session.inFlightIndices.add(index));
        return job;
    }

    /**
     * 执行一个已被消费者认领的批次，并按规则最多重新入队两次。
     *
     * @param session 当前字幕翻译会话。
     * @param job 已认领的批次任务。
     */
    private startJob(
        session: SubtitleTranslationSession<TContext>,
        job: SubtitleTranslationJob<TContext>
    ): void {
        const controller = new AbortController();
        job.controller = controller;
        const request: SubtitleTranslationBatchRequest<TContext> = {
            fileHash: session.fileHash,
            batchId: job.batchId,
            indices: job.indices,
            demandId: session.demandId,
            priority: job.priority,
            requeueCount: job.requeueCount,
            context: job.context,
            signal: controller.signal,
        };

        void this.options.executeBatch(request)
            .then((result) => {
                if (result.cancelled || controller.signal.aborted) {
                    return;
                }

                result.completedIndices.forEach((index) => {
                    session.completedIndices.add(index);
                });
                const failedIndices = result.failedIndices.filter((index) =>
                    !session.completedIndices.has(index)
                );
                if (failedIndices.length > 0) {
                    this.requeueOrDeadLetter(session, job, failedIndices, request);
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }
                this.options.onBatchError?.(error, {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    indices: request.indices,
                    demandId: request.demandId,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    context: request.context,
                });
                this.requeueOrDeadLetter(session, job, job.indices, request);
            })
            .finally(() => {
                job.indices.forEach((index) => session.inFlightIndices.delete(index));
                session.runningJobs.delete(job.batchId);
                if (this.sessions.get(session.fileHash) === session) {
                    this.refreshWindow(session);
                    this.schedule(session);
                }
            });
    }

    /**
     * 将失败句子重新放回当前窗口，超过次数后进入死信状态。
     *
     * @param session 当前字幕翻译会话。
     * @param job 已完成一次执行的任务。
     * @param indices 本次需要重试的句子索引。
     * @param request 本次执行使用的稳定批次参数。
     */
    private requeueOrDeadLetter(
        session: SubtitleTranslationSession<TContext>,
        job: SubtitleTranslationJob<TContext>,
        indices: number[],
        request: SubtitleTranslationBatchRequest<TContext>
    ): void {
        const retryableIndices = indices.filter((index) =>
            !session.completedIndices.has(index)
            && !session.deadIndices.has(index)
        );
        if (retryableIndices.length === 0) {
            return;
        }

        if (!this.isBatchInCurrentWindow(session, job.batchStart)) {
            this.options.onBatchDropped?.({
                ...request,
                indices: retryableIndices,
            });
            return;
        }

        if (job.requeueCount >= MAX_REQUEUE_COUNT) {
            retryableIndices.forEach((index) => session.deadIndices.add(index));
            this.options.onBatchDeadLetter?.({
                ...request,
                indices: retryableIndices,
            });
            return;
        }

        const retryJob: SubtitleTranslationJob<TContext> = {
            batchId: job.batchId,
            batchStart: job.batchStart,
            indices: retryableIndices,
            priority: this.getPriority(job.batchStart, session.currentBatchStart),
            requeueCount: job.requeueCount + 1,
            context: session.context,
        };
        session.pendingJobs.push(retryJob);
        this.options.onBatchRequeued?.({
            fileHash: session.fileHash,
            batchId: retryJob.batchId,
            indices: retryJob.indices,
            demandId: session.demandId,
            priority: retryJob.priority,
            requeueCount: retryJob.requeueCount,
            context: retryJob.context,
        });
    }

    /**
     * 创建当前调度器范围内唯一的批次编号。
     *
     * @param fileHash 字幕文件哈希。
     * @returns 可写入日志的批次编号。
     */
    private createBatchId(fileHash: string): string {
        const batchId = `subtitle-${this.nextBatchId}`;
        this.nextBatchId += 1;
        return `${fileHash.slice(0, 12)}:${batchId}`;
    }

    /**
     * 计算当前字幕所属的五句批次起点（坐标空间）。
     *
     * @param index 当前字幕稳定坐标。
     * @returns 批次起始坐标。
     */
    private getBatchStart(index: number): number {
        return Math.floor(index / SUBTITLE_BATCH_SIZE) * SUBTITLE_BATCH_SIZE;
    }

    /**
     * 返回指定坐标区间内实际存在的字幕稳定坐标。
     *
     * 区间为 [batchStart, batchStart + SUBTITLE_BATCH_SIZE)。增量转录的坐标
     * 在分片边界处存在间隔，因此返回数量可能小于批次大小，且不会跨分片拼批。
     *
     * @param session 当前字幕翻译会话。
     * @param batchStart 批次起始坐标。
     * @returns 批次内的有效稳定坐标，按升序排列。
     */
    private getBatchIndices(
        session: SubtitleTranslationSession<TContext>,
        batchStart: number
    ): number[] {
        const end = batchStart + SUBTITLE_BATCH_SIZE;
        return session.sentenceIndices.filter(
            (index) => index >= batchStart && index < end
        );
    }

    /**
     * 判断批次是否仍在当前四批窗口内（包含前一批次）。
     *
     * @param session 当前字幕翻译会话。
     * @param batchStart 批次起点。
     * @returns 批次仍有效时返回 true。
     */
    private isBatchInCurrentWindow(
        session: SubtitleTranslationSession<TContext>,
        batchStart: number
    ): boolean {
        return batchStart >= session.currentBatchStart
            - SUBTITLE_WINDOW_BATCH_BEFORE_COUNT * SUBTITLE_BATCH_SIZE
            && batchStart < session.currentBatchStart
            + (SUBTITLE_WINDOW_BATCH_COUNT - SUBTITLE_WINDOW_BATCH_BEFORE_COUNT)
            * SUBTITLE_BATCH_SIZE;
    }

    /**
     * 返回批次相对于当前播放位置的优先级。
     *
     * @param batchStart 批次起点。
     * @param currentBatchStart 当前播放批次起点。
     * @returns 当前批次和下一批次为 high，前一批次与下下批次为 low。
     */
    private getPriority(
        batchStart: number,
        currentBatchStart: number
    ): SubtitleTranslationPriority {
        const batchOffset = Math.floor(
            (batchStart - currentBatchStart) / SUBTITLE_BATCH_SIZE
        );
        return batchOffset >= 0 && batchOffset < HIGH_PRIORITY_BATCH_COUNT
            ? 'high'
            : 'low';
    }

    /**
     * 将优先级转换为排序权重。
     *
     * @param priority 批次优先级。
     * @returns 数值越大越优先。
     */
    private priorityRank(priority: SubtitleTranslationPriority): number {
        return priority === 'high' ? 1 : 0;
    }

    /**
     * 取消会话内所有正在执行的任务。
     *
     * 只有释放字幕或切换翻译配置时才会调用；播放位置滚动不会取消已经发出的请求。
     *
     * @param session 需要停止的字幕会话。
     */
    private abortSession(session: SubtitleTranslationSession<TContext>): void {
        session.runningJobs.forEach((job) => job.controller?.abort());
    }
}
