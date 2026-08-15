import { SrtSentence } from '@/common/types/SentenceC';
import { SubtitleVocabularyAnalysisService } from '@/backend/services/SubtitleVocabularyAnalysisService';

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
 * 将共享字幕生词结果转换为裁切候选片段。
 *
 * 这里不再执行单词匹配，只负责消费共享的逐行结果。
 */
export default class VideoLearningClipAnalysis {
    private readonly candidates = new Map<string, ClipCandidate[]>();

    /**
     * 创建裁切候选转换器。
     *
     * @param getVocabularyAnalysisService 延迟获取共享字幕生词分析服务。
     */
    public constructor(
        private readonly getVocabularyAnalysisService: () => SubtitleVocabularyAnalysisService,
    ) {}

    /**
     * 读取已完成的候选片段缓存。
     *
     * @param srtKey 字幕缓存键。
     * @returns 已完成时返回候选片段，否则返回 undefined。
     */
    public getCachedCandidates(srtKey: string): ClipCandidate[] | undefined {
        return this.candidates.get(srtKey);
    }

    /**
     * 判断指定字幕是否仍在分析。
     *
     * @param srtKey 字幕缓存键。
     * @returns 存在运行中的共享分析任务时返回 true。
     */
    public isRunning(srtKey: string): boolean {
        return this.getVocabularyAnalysisService().getStatus(srtKey).status === 'analyzing';
    }

    /**
     * 读取正在进行的共享分析进度。
     *
     * @param srtKey 字幕缓存键。
     * @returns 当前进度；未开始时返回 undefined。
     */
    public getProgress(srtKey: string): number | undefined {
        const status = this.getVocabularyAnalysisService().getStatus(srtKey);
        return status.status === 'analyzing' ? status.progress : undefined;
    }

    /**
     * 读取已缓存分块可推导出的续跑进度。
     *
     * @param srtKey 字幕缓存键。
     * @returns 当前已有的分析进度；没有缓存时返回 undefined。
     */
    public getCachedProgress(srtKey: string): number | undefined {
        const status = this.getVocabularyAnalysisService().getStatus(srtKey);
        return status.status === 'idle' ? undefined : status.progress;
    }

    /**
     * 根据共享逐行生词结果生成可裁切片段。
     *
     * 同一字幕的重复调用复用候选缓存；尚未完成时等待共享分析任务。
     *
     * @param srtKey 字幕缓存键。
     * @param srt 已加载的字幕内容。
     * @param onProgress 分析进度通知。
     * @returns 可裁切片段列表。
     */
    public async collectCandidates(
        srtKey: string,
        srt: SrtSentence,
        onProgress?: (progress: number) => Promise<void> | void,
    ): Promise<ClipCandidate[]> {
        const cachedCandidates = this.candidates.get(srtKey);
        if (cachedCandidates) {
            return cachedCandidates;
        }

        const texts = srt.sentences.map((sentence) => sentence.text.toLowerCase());
        const analysis = await this.getVocabularyAnalysisService().analyze(
            srt.fileHash,
            texts,
            onProgress,
        );

        const result: ClipCandidate[] = srt.sentences.flatMap((sentence, indexInSrt) => {
            const matchedWords = Array.from(
                new Set(
                    (analysis.lineMatches[indexInSrt] ?? [])
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

        this.candidates.set(srtKey, result);
        return result;
    }

    /**
     * 清除裁切候选缓存和共享字幕分析缓存。
     */
    public clear(): void {
        this.candidates.clear();
        this.getVocabularyAnalysisService().invalidate();
    }
}
