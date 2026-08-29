import { getMainLogger } from '@/backend/infrastructure/logger';
import { SentenceBlockBySpace, SentenceBlockPart, SentenceStruct } from '@/common/types/SentenceStruct';
import StrUtil from '@/common/utils/str-util';
import { Sentence, SrtSentence } from '@/common/types/SentenceC';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';
import CacheService from '@/backend/services/CacheService';
import { SubtitleTimestampAdjustment } from '@/common/contracts/subtitle-timestamp-adjustment';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";
import MediaUtil from '@/common/utils/MediaUtil';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import { SubtitleVocabularyAnalysisService } from '@/backend/services/SubtitleVocabularyAnalysisService';
import {
    WinkSentenceElementParser,
    SentenceElement,
    SentenceElementParser
} from '@/backend/utils/language/SentenceElementParser';

/**
 * 字幕生词匹配结果。
 */
export interface SubtitleVocabularyMatchResult {
    /** 当前播放视频 ID。 */
    videoId: string;
    /** 当前字幕加载会话 ID。 */
    playbackSessionId: string;
    /** 字幕文件哈希，用于前端隔离过期结果。 */
    fileHash: string;
    /** 当前字幕命中词条的 canonical lemma 列表。 */
    vocabularyWords: string[];
    /** 匹配过程中是否因字幕切换而提前终止。 */
    cancelled: boolean;
}

/**
 * 提供字幕解析与独立生词匹配能力。
 */
export default interface SubtitleService {
    /**
     * 将字幕文件解析为播放器句子。
     *
     * @param path 字幕文件路径。
     * @returns 已结构化的字幕句子。
     */
    parseSrt(path: string): Promise<SrtSentence>;

    /**
     * 从已分段的 SrtLine 数组直接构建播放器句子并注册到内存缓存。
     *
     * 用于增量转录场景：后端每完成一个块后，将所有已完成块的 SrtLine
     * 一次性构建为 Sentence[]，注册到 cache:srt 供翻译调度器读取。
     *
     * @param lines 已按时间排序并赋予全局稳定序号的 SrtLine 数组。
     * @param identityOverride 用作 fileHash 的稳定标识（如转录会话 sessionId）。
     * @param options.transient 为 true 时标记缓存条目为临时数据，翻译结果不落库。
     * @returns 构建后的字幕句子集合。
     */
    buildSentencesFromLines(
        lines: SrtLine[],
        identityOverride: string,
        options?: { transient?: boolean }
    ): SrtSentence;

    /**
     * 激活当前播放视频，并使上一视频的生词匹配任务失效。
     *
     * @param videoId 当前播放视频 ID。
     */
    activatePlaybackVideo(videoId: string): void;

    /**
     * 为当前视频启动新的字幕加载会话。
     *
     * @param subtitlePath 字幕文件路径；空值表示当前视频没有字幕。
     * @param videoId 当前播放视频 ID。
     * @param playbackSessionId 字幕加载会话 ID。
     * @returns 已结构化的字幕；会话已过期或没有字幕时返回 `null`。
     */
    parseSrtForPlayback(
        subtitlePath: string | null,
        videoId: string,
        playbackSessionId: string,
    ): Promise<SrtSentence | null>;

    /**
     * 匹配当前播放字幕中出现的用户生词。
     *
     * @param fileHash 字幕文件哈希。
     * @param videoId 当前播放视频 ID。
     * @param playbackSessionId 字幕加载会话 ID。
     * @returns 带字幕哈希的生词匹配结果。
     */
    matchVocabulary(
        fileHash: string,
        videoId: string,
        playbackSessionId: string,
    ): Promise<SubtitleVocabularyMatchResult>;

    /**
     * 词表变化后清除共享字幕生词分析缓存。
     */
    invalidateVocabularyAnalysisCache(): void;
}


/**
 * 生成稳定句子翻译键。
 * 说明：翻译结果按句保存时，仅需要稳定定位，不应混入上下文窗口语义。
 *
 * @param fileHash 字幕文件哈希。
 * @param index 当前句索引。
 * @returns 稳定句子翻译键。
 */
function generateTranslationKey(fileHash: string, index: number): string {
    return `${fileHash}:${index}`;
}

function groupSentence(
    subtitle: Sentence[],
    batch: number,
    fieldConsumer: (s: Sentence, index: number) => void
) {
    const groups: Sentence[][] = [];
    let group: Sentence[] = [];
    subtitle.forEach((item) => {
        group.push(item);
        if (group.length >= batch) {
            groups.push(group);
            group = [];
        }
    });
    if (group.length > 0) {
        groups.push(group);
    }
    groups.forEach((item, index) => {
        item.forEach((s) => {
            fieldConsumer(s, index);
        });
    });
}
const logger = getMainLogger('SubtitleServiceImpl');

/**
 * 负责字幕文件解析、时间轴调整和播放页生词匹配。
 */
@injectable()
export class SubtitleServiceImpl implements SubtitleService {

    private readonly sentenceElementParser: SentenceElementParser = new WinkSentenceElementParser();
    /** 当前生词匹配任务代次；新播放会话或新匹配任务会使旧代次失效。 */
    private vocabularyMatchGeneration = 0;
    /** 当前播放视频 ID，用于阻止旧视频任务重新激活。 */
    private activePlaybackVideoId: string | null = null;
    /** 当前字幕加载会话 ID。 */
    private activePlaybackSessionId: string | null = null;

    @inject(TYPES.SrtTimeAdjustService)
    private srtTimeAdjustService!: SrtTimeAdjustService;
    @inject(TYPES.CacheService)
    private cacheService!: CacheService;
    @inject(TYPES.SubtitleVocabularyAnalysisService)
    private vocabularyAnalysisService!: SubtitleVocabularyAnalysisService;
    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;
    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

    /**
     * 解析字幕文件并缓存后续生词匹配所需的纯文本。
     *
     * 该方法只负责字幕解析，不再隐式启动生词匹配。
     *
     * @param path 字幕文件路径。
     * @returns 已结构化并应用时间轴调整的字幕。
     */
    public async parseSrt(path: string): Promise<SrtSentence> {
        if (!(await this.fileSystemGateway.fileExists(path))) {
            throw new Error(`字幕文件不存在：${path}`);
        }
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(path);
        const content = await this.fileSystemGateway.readTextFile(path);
        const hashKey = ObjUtil.hash(content);
        const cache = this.cacheService.get('cache:srt', hashKey);
        if (cache) {
            this.cacheVocabularyTexts(hashKey, cache.sentences);
            const adjustedSentence = await this.adjustTime(cache.sentences, hashKey);
            return {
                fileHash: hashKey,
                filePath: path,
                sentences: adjustedSentence
            };
        }
        const lines: SrtLine[] = MediaUtil.isAss(path) ? SrtUtil.parseAss(content) : SrtUtil.parseSrt(content);
        const subtitles = lines.map<Sentence>((line, index) => ({
            fileHash: hashKey,
            index: index,
            start: line.start,
            end: line.end,
            adjustedStart: null,
            adjustedEnd: null,
            text: line.contentEn,
            textZH: line.contentZh,
            key: `${hashKey}-${index}`,
            transGroup: 0,
            translationKey: generateTranslationKey(hashKey, index),
            struct: this.processSentence(line.contentEn)
        }));
        groupSentence(subtitles, 20, (s, index) => {
            s.transGroup = index;
        });
        const res = {
            fileHash: hashKey,
            filePath: path,
            sentences: subtitles
        };
        this.cacheService.set('cache:srt', hashKey, res);
        this.cacheVocabularyTexts(hashKey, subtitles);
        const adjustedSentence = await this.adjustTime(subtitles, hashKey);

        return {
            ...res,
            sentences: adjustedSentence
        };
    }

    /** {@inheritDoc SubtitleService.buildSentencesFromLines} */
    public buildSentencesFromLines(
        lines: SrtLine[],
        identityOverride: string,
        options?: { transient?: boolean }
    ): SrtSentence {
        const subtitles = lines.map<Sentence>((line) => ({
            fileHash: identityOverride,
            index: line.index,
            start: line.start,
            end: line.end,
            adjustedStart: null,
            adjustedEnd: null,
            text: line.contentEn,
            textZH: line.contentZh,
            key: `${identityOverride}-${line.index}`,
            transGroup: 0,
            translationKey: generateTranslationKey(identityOverride, line.index),
            struct: this.processSentence(line.contentEn)
        }));
        groupSentence(subtitles, 20, (s, index) => {
            s.transGroup = index;
        });
        const res: SrtSentence = {
            fileHash: identityOverride,
            filePath: '',
            sentences: subtitles,
            transient: options?.transient ?? false,
        };
        this.cacheService.set('cache:srt', identityOverride, res);
        return res;
    }

    /**
     * 激活当前播放视频，并使上一视频的生词匹配任务失效。
     *
     * 重复读取同一视频详情不会创建新代次，避免播放器 ready 阶段的详情查询
     * 意外取消当前视频刚启动的字幕任务。
     *
     * @param videoId 当前播放视频 ID。
     */
    public activatePlaybackVideo(videoId: string): void {
        if (this.activePlaybackVideoId === videoId) {
            return;
        }
        this.vocabularyAnalysisService.cancelActive();
        this.activePlaybackVideoId = videoId;
        this.activePlaybackSessionId = null;
        this.vocabularyMatchGeneration += 1;
    }

    /**
     * 为当前视频启动新的字幕加载会话。
     *
     * 新会话会立即使同一视频的旧生词任务失效。旧视频发来的迟到请求不会反向
     * 覆盖当前播放视频；空字幕路径只更新会话，不执行文件解析。
     *
     * @param subtitlePath 字幕文件路径；空值表示当前视频没有字幕。
     * @param videoId 当前播放视频 ID。
     * @param playbackSessionId 字幕加载会话 ID。
     * @returns 已结构化的字幕；会话已过期或没有字幕时返回 `null`。
     */
    public async parseSrtForPlayback(
        subtitlePath: string | null,
        videoId: string,
        playbackSessionId: string,
    ): Promise<SrtSentence | null> {
        if (this.activePlaybackVideoId !== videoId) {
            return null;
        }

        this.vocabularyAnalysisService.cancelActive();
        this.activePlaybackSessionId = playbackSessionId;
        this.vocabularyMatchGeneration += 1;
        if (StrUtil.isBlank(subtitlePath)) {
            return null;
        }

        return this.parseSrt(subtitlePath!);
    }

    /**
     * 分块匹配已解析字幕中的用户生词。
     *
     * 每批处理后主动让步，避免长字幕的生词匹配持续占用主进程事件循环。
     *
     * @param fileHash 字幕文件哈希。
     * @param videoId 当前播放视频 ID。
     * @param playbackSessionId 字幕加载会话 ID。
     * @returns 带字幕哈希的去重生词列表。
     */
    public async matchVocabulary(
        fileHash: string,
        videoId: string,
        playbackSessionId: string,
    ): Promise<SubtitleVocabularyMatchResult> {
        if (!this.isPlaybackSessionCurrent(videoId, playbackSessionId)) {
            return this.createCancelledVocabularyResult(fileHash, videoId, playbackSessionId);
        }

        const texts = this.cacheService.get('cache:srt-vocabulary-texts', fileHash);
        if (!texts) {
            throw new Error(`字幕生词匹配上下文不存在：${fileHash}`);
        }

        const generation = ++this.vocabularyMatchGeneration;
        let analysisResult: Awaited<ReturnType<SubtitleVocabularyAnalysisService['analyze']>>;
        try {
            analysisResult = await this.vocabularyAnalysisService.analyze(
                fileHash,
                texts,
                undefined,
                () => this.isVocabularyMatchCurrent(generation, videoId, playbackSessionId),
            );
        } catch (error) {
            if (
                error instanceof Error
                && (
                    error.message === 'SUBTITLE_VOCABULARY_ANALYSIS_CANCELLED'
                    || error.message === 'SUBTITLE_VOCABULARY_ANALYSIS_REPLACED'
                    || error.message === 'SUBTITLE_VOCABULARY_ANALYSIS_INVALIDATED'
                )
            ) {
                return this.createCancelledVocabularyResult(fileHash, videoId, playbackSessionId);
            }
            throw error;
        }

        if (!this.isVocabularyMatchCurrent(generation, videoId, playbackSessionId)) {
            return this.createCancelledVocabularyResult(fileHash, videoId, playbackSessionId);
        }

        const vocabularyWords = new Set<string>();
        analysisResult.lineMatches.flat().forEach((matchedWord) => {
            vocabularyWords.add(matchedWord.lemma.toLowerCase());
        });

        const result = Array.from(vocabularyWords);
        logger.info('vocabulary matching completed', {
            count: result.length,
            fileHash,
        });
        return {
            videoId,
            playbackSessionId,
            fileHash,
            vocabularyWords: result,
            cancelled: false,
        };
    }

    /**
     * 清除词表变化前生成的共享字幕生词分析。
     */
    public invalidateVocabularyAnalysisCache(): void {
        this.vocabularyAnalysisService.invalidate();
    }

    /**
     * 判断指定播放字幕会话是否仍为当前会话。
     *
     * @param videoId 待检查的播放视频 ID。
     * @param playbackSessionId 待检查的字幕加载会话 ID。
     * @returns 仍为当前会话时返回 `true`。
     */
    private isPlaybackSessionCurrent(videoId: string, playbackSessionId: string): boolean {
        return (
            this.activePlaybackVideoId === videoId
            && this.activePlaybackSessionId === playbackSessionId
        );
    }

    /**
     * 判断指定生词匹配代次是否仍为当前任务。
     *
     * @param generation 待检查的任务代次。
     * @param videoId 待检查的播放视频 ID。
     * @param playbackSessionId 待检查的字幕加载会话 ID。
     * @returns 仍为当前任务时返回 `true`。
     */
    private isVocabularyMatchCurrent(
        generation: number,
        videoId: string,
        playbackSessionId: string,
    ): boolean {
        return (
            generation === this.vocabularyMatchGeneration
            && this.isPlaybackSessionCurrent(videoId, playbackSessionId)
        );
    }

    /**
     * 创建已取消的生词匹配结果。
     *
     * @param fileHash 被取消任务对应的字幕哈希。
     * @param videoId 被取消任务对应的播放视频 ID。
     * @param playbackSessionId 被取消任务对应的字幕加载会话 ID。
     * @returns 不包含部分匹配数据的取消结果。
     */
    private createCancelledVocabularyResult(
        fileHash: string,
        videoId: string,
        playbackSessionId: string,
    ): SubtitleVocabularyMatchResult {
        logger.debug('vocabulary matching cancelled', {
            fileHash,
            videoId,
            playbackSessionId,
        });
        return {
            videoId,
            playbackSessionId,
            fileHash,
            vocabularyWords: [],
            cancelled: true,
        };
    }

    /**
     * 缓存生词匹配所需的英文字幕文本。
     *
     * 保留空字幕行，以便共享分析结果与原字幕行号一一对应；
     * 空行不会产生匹配结果，但不能在这里提前过滤。
     *
     * @param fileHash 字幕文件哈希。
     * @param sentences 已解析字幕句子。
     */
    private cacheVocabularyTexts(fileHash: string, sentences: Sentence[]): void {
        const texts = sentences
            .map((sentence) => sentence.text || '');
        this.cacheService.set('cache:srt-vocabulary-texts', fileHash, texts);
    }


    private async adjustTime(subtitles: Sentence[], hashCode: string): Promise<Sentence[]> {
        const adjs = await this.srtTimeAdjustService.getByHash(hashCode);
        const mapping: Map<string, SubtitleTimestampAdjustment> = new Map();
        adjs.forEach((item) => {
            mapping.set(item.key, item);
        });
        return subtitles.map((item) => {
            const adj = mapping.get(item.key);
            if (!adj) {
                return item;
            }
            return {
                ...item,
                adjustedStart: adj.start_at,
                adjustedEnd: adj.end_at
            };
        });
    }

    /**
     * 将字幕原文转换为前端展示结构。
     *
     * @param sentence 原始句子。
     * @returns 结构化句子。
     */
    private processSentence(sentence: string): SentenceStruct {
        const elements = this.sentenceElementParser.parse(sentence);
        const blocks: SentenceBlockBySpace[] = [];
        let blockParts: SentenceBlockPart[] = [];

        for (const element of elements) {
            blockParts = this.appendElementToBlocks(element, blocks, blockParts);
        }

        if (blockParts.length > 0) {
            blocks.push({ blockParts });
        }

        return {
            original: sentence,
            blocks
        };
    }

    /**
     * 将单个句子元素追加到结构化块中。
     *
     * @param element 句子元素。
     * @param blocks 目标块列表。
     * @param blockParts 当前块内容。
     * @returns 更新后的当前块内容。
     */
    private appendElementToBlocks(
        element: SentenceElement,
        blocks: SentenceBlockBySpace[],
        blockParts: SentenceBlockPart[]
    ): SentenceBlockPart[] {
        if (element.kind === 'word') {
            blockParts.push({
                content: element.text,
                implicit: element.implicit ?? '',
                lemma: element.implicit,
                pos: element.pos,
                isWord: true,
            });
            return blockParts;
        }

        return this.appendTextElement(element.text, blocks, blockParts);
    }

    /**
     * 处理非单词文本元素。
     *
     * 行为说明：
     * - 空白用于切分 block。
     * - 非空白文本直接作为普通片段落入当前 block。
     *
     * @param text 非单词文本。
     * @param blocks 目标块列表。
     * @param blockParts 当前块内容。
     * @returns 更新后的当前块内容。
     */
    private appendTextElement(
        text: string,
        blocks: SentenceBlockBySpace[],
        blockParts: SentenceBlockPart[]
    ): SentenceBlockPart[] {
        const segments = text.split(/(\s+)/u).filter((segment) => segment.length > 0);
        let currentBlockParts = blockParts;

        for (const segment of segments) {
            if (StrUtil.isBlank(segment)) {
                if (currentBlockParts.length > 0) {
                    blocks.push({ blockParts: currentBlockParts });
                    currentBlockParts = [];
                }
                continue;
            }

            currentBlockParts.push({
                content: segment,
                implicit: '',
                isWord: false,
            });
        }

        return currentBlockParts;
    }
}
