import { getMainLogger } from '@/backend/infrastructure/logger';
import { SentenceBlockBySpace, SentenceBlockPart, SentenceStruct } from '@/common/types/SentenceStruct';
import StrUtil from '@/common/utils/str-util';
import fs from 'fs';
import { Sentence, SrtSentence } from '@/common/types/SentenceC';
import { inject, injectable } from 'inversify';
import SubtitleService from '@/backend/application/services/SubtitleService';
import TYPES from '@/backend/ioc/types';
import SrtTimeAdjustService from '@/backend/application/services/SrtTimeAdjustService';
import FileUtil from '@/backend/utils/FileUtil';
import CacheService from '@/backend/application/services/CacheService';
import { SubtitleTimestampAdjustment } from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import SrtUtil, {SrtLine} from "@/common/utils/SrtUtil";
import MediaUtil from '@/common/utils/MediaUtil';
import {WordMatchService} from '@/backend/application/services/WordMatchService';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import {
    CompromiseSentenceElementParser,
    SentenceElement,
    SentenceElementParser
} from '@/backend/application/kernel/language/SentenceElementParser';

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
@injectable()
export class SubtitleServiceImpl implements SubtitleService {

    private readonly sentenceElementParser: SentenceElementParser = new CompromiseSentenceElementParser();

    @inject(TYPES.SrtTimeAdjustService)
    private srtTimeAdjustService!: SrtTimeAdjustService;
    @inject(TYPES.CacheService)
    private cacheService!: CacheService;
    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;
    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;
    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    public async parseSrt(path: string): Promise<SrtSentence> {
        if (!fs.existsSync(path)) {
            throw new Error('file not exists');
        }
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(path);
        const content = await FileUtil.read(path);
        TypeGuards.assertNotNull(content, 'read file error');
        const hashKey = ObjUtil.hash(content);
        const cache = this.cacheService.get('cache:srt', hashKey);
        if (cache) {
            const adjustedSentence = await this.adjustTime(cache.sentences, hashKey);
            // 异步调用单词匹配，不阻塞返回
            this.processVocabularyMatching(cache.sentences).catch(error => {
                logger.error('Error processing vocabulary matching from cache:', error);
            });
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
        const adjustedSentence = await this.adjustTime(subtitles, hashKey);

        // 异步调用单词匹配，不阻塞返回
        this.processVocabularyMatching(adjustedSentence).catch(error => {
            logger.error('Error processing vocabulary matching:', error);
        });

        return {
            ...res,
            sentences: adjustedSentence
        };
    }

    private async processVocabularyMatching(sentences: Sentence[]): Promise<void> {
        try {
            // 检查sentences是否有效
            if (!sentences || sentences.length === 0) {
                logger.debug('No sentences to process for vocabulary matching');
                return;
            }

            // 过滤掉空的文本
            const validTexts = sentences
                .map(s => s?.text)
                .filter(text => text && typeof text === 'string' && text.trim().length > 0);

            if (validTexts.length === 0) {
                logger.debug('No valid texts to process for vocabulary matching');
                return;
            }

            const allText = validTexts.join(' ');
            const matchedWords = await this.wordMatchService.matchWordsInText(allText);

            logger.debug('matched words', matchedWords);
            if (matchedWords && matchedWords.length > 0) {
                const vocabularyWords = matchedWords.map(mw => mw.original.toLowerCase());
                if (vocabularyWords.length > 0) {
                    await this.rendererGateway.call('vocabulary/match-result', { vocabularyWords });
                    logger.info(`Vocabulary matching completed: ${vocabularyWords.length} words found`);
                    logger.debug('Vocabulary words being sent to frontend:', { vocabularyWords });
                }
            } else {
                logger.debug('No vocabulary words matched');
            }
        } catch (error) {
            logger.error('Error in vocabulary matching:', error);
        }
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
