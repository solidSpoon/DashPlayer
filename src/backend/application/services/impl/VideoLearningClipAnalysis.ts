import { concurrency } from '@/backend/application/kernel/concurrency';
import { MatchedWord } from '@/backend/application/services/WordMatchService';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';

import { SrtSentence } from '@/common/types/SentenceC';

/**
 * 字幕分析得到的可裁切片段。
 */
export type ClipCandidate = {
    /** 字幕行序号。 */
    indexInSrt: number;
    /** 片段稳定键。 */
    clipKey: string;
    /** 当前片段命中的单词列表。 */
    matchedWords: string[];
};

/**
 * 单次字幕分析的缓存与运行状态。
 */
type ClipAnalysisState = {
    /** 已完成分析时保存的全部候选片段。 */
    candidates?: ClipCandidate[];
    /** 已完成的分块匹配结果，用于分析中断后的续跑。 */
    chunks: Map<number, MatchedWord[][]>;
    /** 当前字幕按固定大小拆出的分块总数。 */
    totalChunks: number;
    /** 最近一次已通知的分析进度，范围为 0 到 100。 */
    progress?: number;
};

/**
 * 全局唯一的当前字幕分析任务。
 */
type ActiveAnalysis = {
    /** 正在分析的字幕缓存键。 */
    srtKey: string;
    /** 用于区分同一字幕的不同分析轮次。 */
    runId: number;
    /** 当前分析任务的结果。 */
    promise: Promise<ClipCandidate[]>;
};

/**
 * 字幕文本批量匹配函数。
 */
type MatchTexts = (texts: string[]) => Promise<MatchedWord[][]>;

/**
 * 将字幕中的单词命中结果转换为学习片段候选项，并维护分析缓存。
 *
 * 这个类只处理分析状态和纯业务计算；字幕加载、状态通知与裁切队列仍由
 * VideoLearningServiceImpl 编排。
 */
export default class VideoLearningClipAnalysis {
    private readonly states = new Map<string, ClipAnalysisState>();
    private readonly scheduler = concurrency.scheduler('default');
    /** 当前系统中唯一允许运行的字幕分析任务。 */
    private activeAnalysis?: ActiveAnalysis;
    /** 单调递增的任务序号，用于识别已被替换的旧任务。 */
    private nextRunId = 0;

    /**
     * 创建字幕分析器。
     *
     * @param matchTexts 批量匹配字幕文本中单词的能力。
     */
    public constructor(private readonly matchTexts: MatchTexts) {}

    /**
     * 读取已完成的候选片段缓存。
     *
     * @param srtKey 字幕缓存键。
     * @returns 已完成时返回候选片段，否则返回 undefined。
     */
    public getCachedCandidates(srtKey: string): ClipCandidate[] | undefined {
        return this.states.get(srtKey)?.candidates;
    }

    /**
     * 判断指定字幕是否仍在分析。
     *
     * @param srtKey 字幕缓存键。
     * @returns 存在运行中的分析任务时返回 true。
     */
    public isRunning(srtKey: string): boolean {
        return this.activeAnalysis?.srtKey === srtKey;
    }

    /**
     * 读取正在进行的分析进度。
     *
     * @param srtKey 字幕缓存键。
     * @returns 未开始或已完成时返回 undefined。
     */
    public getProgress(srtKey: string): number | undefined {
        if (this.activeAnalysis?.srtKey !== srtKey) {
            return undefined;
        }
        return this.states.get(srtKey)?.progress;
    }

    /**
     * 读取已缓存分块可推导出的续跑进度。
     *
     * @param srtKey 字幕缓存键。
     * @returns 没有可用分块缓存时返回 undefined。
     */
    public getCachedProgress(srtKey: string): number | undefined {
        const state = this.states.get(srtKey);
        if (!state || state.totalChunks === 0 || state.chunks.size === 0) {
            return undefined;
        }

        return Math.min(99, Math.round((state.chunks.size / state.totalChunks) * 100));
    }

    /**
     * 分析字幕并返回可以裁切的候选片段。
     *
     * 同一字幕的重复调用会复用当前任务；请求另一份字幕时会取代旧任务。
     * 已完成或已匹配的分块始终按字幕保留，以便稍后续跑。
     *
     * @param srtKey 字幕缓存键。
     * @param srt 已加载的字幕内容。
     * @param onProgress 分析进度变化时的通知回调。
     * @returns 可裁切片段列表。
     */
    public async collectCandidates(
        srtKey: string,
        srt: SrtSentence,
        onProgress?: (progress: number) => Promise<void> | void,
    ): Promise<ClipCandidate[]> {
        const existingState = this.states.get(srtKey);
        if (existingState?.candidates) {
            return existingState.candidates;
        }
        if (this.activeAnalysis?.srtKey === srtKey) {
            return this.activeAnalysis.promise;
        }

        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const contents = srtLines.map((line) => (line.contentEn || '').toLowerCase());
        if (contents.length === 0) {
            const candidates: ClipCandidate[] = [];
            const emptyState: ClipAnalysisState = {
                candidates,
                chunks: new Map(),
                totalChunks: 0,
            };
            this.states.set(srtKey, emptyState);
            return candidates;
        }

        const chunkSize = 50;
        const totalChunks = Math.ceil(contents.length / chunkSize);
        const state = existingState ?? {
            chunks: new Map<number, MatchedWord[][]>(),
            totalChunks,
        };
        if (state.totalChunks !== totalChunks) {
            state.chunks.clear();
            state.totalChunks = totalChunks;
        }
        this.states.set(srtKey, state);

        const previousAnalysis = this.activeAnalysis;
        if (previousAnalysis) {
            const previousState = this.states.get(previousAnalysis.srtKey);
            if (previousState) {
                previousState.progress = undefined;
            }
        }
        const run: ActiveAnalysis = {
            srtKey,
            runId: ++this.nextRunId,
            promise: Promise.resolve([]),
        };
        this.activeAnalysis = run;
        run.promise = this.analyze(srtKey, srtLines, contents, state, run, onProgress);
        return run.promise;
    }

    /**
     * 执行当前字幕的分块单词匹配。
     *
     * @param srtKey 字幕缓存键。
     * @param srtLines 已转换的字幕行。
     * @param contents 用于单词匹配的英文字幕文本。
     * @param state 当前字幕的缓存状态。
     * @param run 本轮全局分析任务。
     * @param onProgress 分析进度变化时的通知回调。
     * @returns 可裁切片段列表。
     */
    private async analyze(
        srtKey: string,
        srtLines: SrtLine[],
        contents: string[],
        state: ClipAnalysisState,
        run: ActiveAnalysis,
        onProgress?: (progress: number) => Promise<void> | void,
    ): Promise<ClipCandidate[]> {
        try {
            this.scheduler.beginFrame();
            const matchResults: MatchedWord[][] = new Array(contents.length);
            let completedChunks = 0;
            const chunkSize = 50;

            for (let chunkIndex = 0; chunkIndex < state.totalChunks; chunkIndex++) {
                const cachedChunk = state.chunks.get(chunkIndex);
                if (!cachedChunk) {
                    continue;
                }

                const start = chunkIndex * chunkSize;
                cachedChunk.forEach((matches, offset) => {
                    matchResults[start + offset] = matches;
                });
                completedChunks++;
            }

            await this.notifyProgress(state, completedChunks, run, onProgress);

            for (let chunkIndex = 0; chunkIndex < state.totalChunks; chunkIndex++) {
                this.assertStateExists(srtKey, state);
                this.assertCurrentRun(run);
                if (state.chunks.has(chunkIndex)) {
                    continue;
                }

                const chunkSize = 50;
                const start = chunkIndex * chunkSize;
                const matches = await this.matchTexts(contents.slice(start, start + chunkSize));
                this.assertStateExists(srtKey, state);
                state.chunks.set(chunkIndex, matches);
                matches.forEach((lineMatches, offset) => {
                    matchResults[start + offset] = lineMatches;
                });

                completedChunks++;
                await this.notifyProgress(state, completedChunks, run, onProgress);
                await this.scheduler.yieldIfNeeded();
            }

            this.assertStateExists(srtKey, state);
            this.assertCurrentRun(run);
            const candidates = srtLines.flatMap((line, indexInSrt) => {
                const matchedWords = Array.from(
                    new Set(
                        (matchResults[indexInSrt] ?? [])
                            .map((match) => (
                                match.databaseWord?.word
                                || match.normalized
                                || match.original
                                || ''
                            ).toLowerCase())
                            .filter(Boolean),
                    ),
                );
                if (matchedWords.length === 0) {
                    return [];
                }

                return [{
                    indexInSrt,
                    clipKey: `${srtKey}__${indexInSrt}`,
                    matchedWords,
                }];
            });

            state.candidates = candidates;
            state.progress = 100;
            if (onProgress) {
                await onProgress(100);
            }
            return candidates;
        } finally {
            if (this.activeAnalysis?.runId === run.runId) {
                this.activeAnalysis = undefined;
                state.progress = undefined;
            }
        }
    }

    /**
     * 清除所有字幕分析缓存和进行中的状态引用。
     *
     * 已经发出的底层单词匹配请求无法强制中断，但其完成结果会被丢弃。
     */
    public clear(): void {
        this.activeAnalysis = undefined;
        this.states.clear();
    }

    /**
     * 更新并通知当前分块分析进度。
     *
     * @param state 正在更新的字幕分析状态。
     * @param completedChunks 已完成的分块数。
     * @param onProgress 分析进度变化时的通知回调。
     */
    private async notifyProgress(
        state: ClipAnalysisState,
        completedChunks: number,
        run: ActiveAnalysis,
        onProgress?: (progress: number) => Promise<void> | void,
    ): Promise<void> {
        const progress = Math.min(99, Math.round((completedChunks / state.totalChunks) * 100));
        this.assertCurrentRun(run);
        state.progress = progress;
        if (onProgress) {
            await onProgress(progress);
        }
    }

    /**
     * 确认当前字幕缓存未被清理。
     *
     * @param srtKey 字幕缓存键。
     * @param state 本轮分析持有的缓存状态。
     */
    private assertStateExists(srtKey: string, state: ClipAnalysisState): void {
        if (this.states.get(srtKey) !== state) {
            throw new Error('CLIP_ANALYSIS_INVALIDATED');
        }
    }

    /**
     * 确认当前分析仍是全局唯一的活动任务。
     *
     * @param run 本轮分析任务。
     */
    private assertCurrentRun(run: ActiveAnalysis): void {
        if (this.activeAnalysis?.runId !== run.runId) {
            throw new Error('CLIP_ANALYSIS_REPLACED');
        }
    }
}
