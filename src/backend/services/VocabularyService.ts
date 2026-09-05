import * as XLSX from 'xlsx';
import { generateText, Output } from 'ai';
import { inject, injectable } from 'inversify';
import { z } from 'zod';
import TYPES from '@/backend/ioc/types';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import { WordMatchService } from '@/backend/services/WordMatchService';
import AiProviderService from '@/backend/services/AiProviderService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import WordsRepository from '@/backend/services/repositories/WordsRepository';
import VideoLearningClipWordRepository from '@/backend/services/repositories/VideoLearningClipWordRepository';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { loadDefaultVocabulary } from '@/backend/utils/defaultVocabulary';
import SubtitleService from '@/backend/services/SubtitleService';
import { lemmatizeWord } from '@/backend/utils/language/VocabularyMatcher';
import { concurrency } from '@/backend/utils/concurrency';

export interface GetAllWordsParams {
    search?: string;
}

export interface GetAllWordsResult {
    success: boolean;
    data?: unknown[];
    error?: string;
}

export interface ExportTemplateResult {
    success: boolean;
    data?: string;
    error?: string;
}

export interface ImportWordsResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * 收藏单词的返回数据。
 */
export interface FavoriteWordData {
    /** 入库的单词（原始形态，小写）。 */
    word: string;
    /** 单词释义。 */
    translate: string;
    /** 单词此前是否已存在。 */
    alreadyExists: boolean;
}

export interface FavoriteWordResult {
    success: boolean;
    data?: FavoriteWordData;
    error?: string;
}

/**
 * 编辑单词参数；单词本身是业务键，需用旧单词定位记录。
 */
export interface UpdateWordParams {
    /** 编辑前的单词。 */
    oldWord: string;
    /** 编辑后的单词。 */
    word: string;
    /** 编辑后的释义。 */
    translate: string;
}

export interface SimpleActionResult {
    success: boolean;
    error?: string;
}

/** 删除单词结果；成功时携带实际删除的入库单词（已还原为原始形态）。 */
export interface DeleteWordResult {
    success: boolean;
    data?: { word: string };
    error?: string;
}

export interface GenerateDefinitionResult {
    success: boolean;
    data?: string;
    error?: string;
}

export default interface VocabularyService {
    getAllWords(params: GetAllWordsParams): Promise<GetAllWordsResult>;
    exportTemplate(): Promise<ExportTemplateResult>;
    importWords(filePath: string): Promise<ImportWordsResult>;
    /**
     * 收藏单词：还原为原始形态后入库。
     *
     * 行为说明：
     * - 输入的变体（复数、时态等）先还原为原始形态（lemma）再查重入库；
     * - 释义优先使用调用方随交互携带的词典结果（如播放器弹窗已查到的释义），
     *   未携带或为空时才调用词典 AI 生成；
     * - 已存在的单词直接返回现有记录（幂等）。
     *
     * @param word 用户点击的单词原文（可能是复数、时态等变体）。
     * @param translate 调用方已有的释义文本；为空时由 AI 生成。
     */
    favoriteWord(word: string, translate?: string): Promise<FavoriteWordResult>;
    /**
     * 编辑单词与释义；单词变化时同步迁移片段关联。
     */
    updateWord(params: UpdateWordParams): Promise<SimpleActionResult>;
    /**
     * 删除单词，并清理其片段关联。
     *
     * 行为说明：
     * - 输入的变体（复数、时态等）先还原为原始形态（lemma）再删除，与收藏入口对称；
     * - 成功时返回实际删除的入库单词，供前端同步生词高亮词表。
     */
    deleteWord(word: string): Promise<DeleteWordResult>;
    /**
     * 调用 AI 为单词生成简明中文释义。
     */
    generateDefinition(word: string): Promise<GenerateDefinitionResult>;
}


/**
 * 单词导入导出服务实现。
 */
@injectable()
export class VocabularyServiceImpl implements VocabularyService {

    @inject(TYPES.VideoLearningService)
    private videoLearningService!: VideoLearningService;

    @inject(TYPES.WordsRepository)
    private wordsRepository!: WordsRepository;

    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;

    @inject(TYPES.AiProviderService)
    private aiProviderService!: AiProviderService;

    @inject(TYPES.VideoLearningClipWordRepository)
    private clipWordRepository!: VideoLearningClipWordRepository;

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

    private readonly logger = getMainLogger('VocabularyServiceImpl');

    /**
     * 将单词列表转换为 Excel 工作表。
     *
     * @param rows 单词数据。
     * @returns 配置好列宽的工作表。
     */
    private createVocabularyWorksheet(rows: Array<{ 英文: string; 释义: string }>) {
        const headers = ['英文', '释义'];
        const worksheet = rows.length > 0
            ? XLSX.utils.json_to_sheet(rows, { header: headers })
            : XLSX.utils.aoa_to_sheet([headers]);

        worksheet['!cols'] = [
            { wch: 25 },
            { wch: 50 }
        ];

        return worksheet;
    }

    /**
     * 为默认词表工作表补充恢复说明区域。
     *
     * 行为说明：
     * - 说明放在右侧独立单元格，不遮挡词表正文。
     * - 单元格正文只显示简短标题，详细说明通过批注展示。
     *
     * @param worksheet 默认词表工作表。
     */
    private addDefaultVocabularyRestoreNote(worksheet: XLSX.WorkSheet): void {
        worksheet.D1 = {
            t: 's',
            v: '恢复说明',
            c: [
                {
                    a: 'DashPlayer',
                    t: '如果想恢复默认词表，可以把这一页的内容复制到第一个工作表“单词管理”里，然后再导入。'
                }
            ]
        };

        const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');
        range.e.c = Math.max(range.e.c, 3);
        range.e.r = Math.max(range.e.r, 0);
        worksheet['!ref'] = XLSX.utils.encode_range(range);

        const baseCols = worksheet['!cols'] ?? [];
        baseCols[0] = baseCols[0] ?? { wch: 25 };
        baseCols[1] = baseCols[1] ?? { wch: 50 };
        baseCols[3] = baseCols[3] ?? { wch: 12 };
        worksheet['!cols'] = baseCols;
    }

    /**
     * 解析导入工作表并归一化为完整词表。
     *
     * 行为说明：
     * - 仅解析第一个工作表。
     * - 单词统一小写归一，并以小写形式为键去重，后出现的行覆盖前面的内容，
     *   避免同一单词的大小写变体分写成两条并撞唯一约束。
     * - 空行会被忽略。
     *
     * @param worksheet Excel 工作表。
     * @returns 归一化后的完整单词列表。
     */
    private parseImportedWords(worksheet: XLSX.WorkSheet) {
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const now = new Date().toISOString();
        const importedWords = new Map<string, { word: string; translate: string | null }>();

        for (const row of jsonData as Array<Record<string, unknown>>) {
            const english = row['英文'] || row['word'] || row['Word'];
            const translate = row['释义'] || row['translate'] || row['Translation'];

            if (!english || typeof english !== 'string' || english.trim() === '') {
                continue;
            }

            const wordText = english.trim().toLowerCase();
            importedWords.set(wordText, {
                word: wordText,
                translate: typeof translate === 'string' ? translate.trim() : null,
            });
        }

        return Array.from(importedWords.values()).map((item) => ({
                word: item.word,
                translate: item.translate || null,
                created_at: now,
                updated_at: now,
        }));
    }

    async getAllWords(params: GetAllWordsParams = {}): Promise<GetAllWordsResult> {
        try {
            const wordsResult = await this.wordsRepository.getAll({ search: params.search });

            return {
                success: true,
                data: wordsResult.map(word => ({
                    id: word.id,
                    word: word.word,
                    translate: word.translate || '',
                    created_at: word.created_at,
                    updated_at: word.updated_at
                }))
            };
        } catch (error) {
            this.logger.error('获取单词失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '获取单词失败'
            };
        }
    }

    /**
     * 导出单词管理模板。
     *
     * 行为说明：
     * - 第一个工作表导出当前用户词表，作为后续导入的唯一数据源。
     * - 第二个工作表导出内置默认词表，便于用户恢复模板内容。
     *
     * @returns Base64 编码的 Excel 文件内容。
     */
    async exportTemplate(): Promise<ExportTemplateResult> {
        try {
            const wordsResult = await this.getAllWords();
            if (!wordsResult.success || !wordsResult.data) {
                return {
                    success: false,
                    error: wordsResult.error || '获取单词数据失败'
                };
            }

            const defaultWords = await loadDefaultVocabulary();
            const currentVocabularyRows = (wordsResult.data as Array<{ word: string; translate: string | null }>).map(word => ({
                英文: word.word,
                释义: word.translate || ''
            }));
            const defaultVocabularyRows = defaultWords.map(word => ({
                英文: word.word,
                释义: word.translate || ''
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, this.createVocabularyWorksheet(currentVocabularyRows), '单词管理');
            const defaultWorksheet = this.createVocabularyWorksheet(defaultVocabularyRows);
            this.addDefaultVocabularyRestoreNote(defaultWorksheet);
            XLSX.utils.book_append_sheet(wb, defaultWorksheet, '默认词表');

            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            return {
                success: true,
                data: Buffer.from(excelBuffer).toString('base64')
            };
        } catch (error) {
            this.logger.error('导出模板失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '导出模板失败'
            };
        }
    }

    /**
     * 导入单词 Excel。
     *
     * 行为说明：
     * - 仅以第一个工作表为准，第二个默认词表页仅供参考。
     * - 导入结果会全量覆盖当前单词表。
     * - 导入完成后会同步重建单词管理片段索引。
     *
     * @param filePath Excel 文件路径。
     * @returns 导入结果。
     */
    async importWords(filePath: string): Promise<ImportWordsResult> {
        try {
            const fileBuffer = await this.fileSystemGateway.readBinaryFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return {
                    success: false,
                    error: '导入失败：未找到第一个工作表'
                };
            }

            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                return {
                    success: false,
                    error: '导入失败：第一个工作表内容为空'
                };
            }

            const existingWords = await this.wordsRepository.getAll();
            const importedWords = this.parseImportedWords(worksheet);
            const existingWordSet = new Set(existingWords.map((item) => item.word));
            const importedWordSet = new Set(importedWords.map((item) => item.word));
            const retainedCount = importedWords.filter((item) => existingWordSet.has(item.word)).length;
            const addedCount = importedWords.length - retainedCount;
            const removedCount = existingWords.filter((item) => !importedWordSet.has(item.word)).length;

            await this.wordsRepository.replaceAll(importedWords);
            this.wordMatchService.invalidateVocabularyCache();
            this.subtitleService.invalidateVocabularyAnalysisCache();

            try {
                await this.videoLearningService.syncFromOss();
                this.videoLearningService.invalidateClipAnalysisCache();
            } catch (syncError) {
                this.logger.error('同步单词管理片段失败', { error: syncError });
                return {
                    success: false,
                    error: syncError instanceof Error
                        ? `单词导入完成，但同步单词管理片段失败：${syncError.message}`
                        : '单词导入完成，但同步单词管理片段失败'
                };
            }

            return {
                success: true,
                message: `导入完成：共 ${importedWords.length} 条，保留 ${retainedCount} 条，新增 ${addedCount} 条，删除 ${removedCount} 条，已同步单词管理片段`
            };
        } catch (error) {
            this.logger.error('导入单词失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '导入单词失败'
            };
        }
    }

    /**
     * 收藏单词。
     *
     * 行为说明：
     * - 输入的变体（复数、时态等）先还原为原始形态（lemma）再查重入库；
     * - 释义优先使用调用方携带的词典结果，未携带时才调用词典 AI 生成；
     * - 已存在的单词直接返回现有记录（幂等）；
     * - 并发收藏同一词的不同变体时，后落库的一方转为已存在返回，不再报错。
     *
     * @param word 用户点击的单词原文。
     * @param translate 调用方已有的释义文本；为空时由 AI 生成。
     * @returns 收藏结果；成功时携带入库单词与释义。
     */
    async favoriteWord(word: string, translate?: string): Promise<FavoriteWordResult> {
        try {
            const input = word?.trim() ?? '';
            if (!input) {
                return {
                    success: false,
                    error: '单词不能为空'
                };
            }

            const lemma = lemmatizeWord(input);
            const existing = await this.wordsRepository.findByWord(lemma);
            if (existing) {
                return {
                    success: true,
                    data: {
                        word: existing.word,
                        translate: existing.translate || '',
                        alreadyExists: true
                    }
                };
            }

            const carriedTranslate = translate?.trim() ?? '';
            const finalTranslate = carriedTranslate || await this.generateDefinitionText(lemma);
            try {
                await this.wordsRepository.insertOne({ word: lemma, translate: finalTranslate });
            } catch (insertError) {
                // 并发收藏同一词的不同变体时会撞唯一约束；重新查到记录即转为已存在返回。
                const raced = await this.wordsRepository.findByWord(lemma);
                if (raced) {
                    return {
                        success: true,
                        data: {
                            word: raced.word,
                            translate: raced.translate || '',
                            alreadyExists: true
                        }
                    };
                }
                throw insertError;
            }
            this.invalidateVocabularyCaches();

            return {
                success: true,
                data: {
                    word: lemma,
                    translate: finalTranslate,
                    alreadyExists: false
                }
            };
        } catch (error) {
            this.logger.error('收藏单词失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '收藏单词失败'
            };
        }
    }

    /**
     * 编辑单词与释义。
     *
     * 行为说明：
     * - 单词是业务键，用旧单词定位记录后整体替换；
     * - 新单词统一小写，与其他单词冲突时明确报错；
     * - 单词变化时同步迁移学习片段关联。
     *
     * @param params 旧单词、新单词与新释义。
     * @returns 操作结果。
     */
    async updateWord(params: UpdateWordParams): Promise<SimpleActionResult> {
        try {
            const oldWord = params.oldWord?.trim().toLowerCase() ?? '';
            const newWord = params.word?.trim().toLowerCase() ?? '';
            if (!oldWord || !newWord) {
                return {
                    success: false,
                    error: '单词不能为空'
                };
            }

            const target = await this.wordsRepository.findByWord(oldWord);
            if (!target) {
                return {
                    success: false,
                    error: '未找到要编辑的单词'
                };
            }

            if (newWord !== oldWord) {
                const conflict = await this.wordsRepository.findByWord(newWord);
                if (conflict) {
                    return {
                        success: false,
                        error: '目标单词已存在'
                    };
                }
            }

            const translate = params.translate?.trim() ?? '';
            await this.wordsRepository.updateByWord(oldWord, { word: newWord, translate });
            if (newWord !== oldWord) {
                await this.clipWordRepository.renameWord(oldWord, newWord);
            }
            this.invalidateVocabularyCaches();

            return { success: true };
        } catch (error) {
            this.logger.error('更新单词失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '更新单词失败'
            };
        }
    }

    /**
     * 删除单词，并清理其学习片段关联。
     *
     * 行为说明：
     * - 输入的变体（复数、时态等）先还原为原始形态（lemma）再删除，与收藏入口对称；
     * - 表中不存在该词时仍返回成功（幂等删除），并携带还原后的单词。
     *
     * @param word 用户操作的单词原文（可能是复数、时态等变体）。
     * @returns 操作结果；成功时携带实际删除的入库单词。
     */
    async deleteWord(word: string): Promise<DeleteWordResult> {
        try {
            const input = word?.trim() ?? '';
            if (!input) {
                return {
                    success: false,
                    error: '单词不能为空'
                };
            }

            const lemma = lemmatizeWord(input);
            await this.wordsRepository.deleteByWord(lemma);
            await this.clipWordRepository.deleteByWord(lemma);
            this.invalidateVocabularyCaches();

            return { success: true, data: { word: lemma } };
        } catch (error) {
            this.logger.error('删除单词失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '删除单词失败'
            };
        }
    }

    /**
     * 调用 AI 为单词生成简明中文释义。
     *
     * @param word 单词。
     * @returns 生成结果；成功时携带释义文本。
     */
    async generateDefinition(word: string): Promise<GenerateDefinitionResult> {
        try {
            const input = word?.trim() ?? '';
            if (!input) {
                return {
                    success: false,
                    error: '单词不能为空'
                };
            }

            const translate = await this.generateDefinitionText(input);
            return {
                success: true,
                data: translate
            };
        } catch (error) {
            this.logger.error('生成释义失败', { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : '生成释义失败'
            };
        }
    }

    /**
     * 调用 AI 生成单词释义文本；失败时抛错，由调用方决定如何呈现。
     *
     * @param word 单词。
     * @returns 生成的释义。
     * @throws 模型未配置、请求失败或返回内容无效时抛出。
     */
    private async generateDefinitionText(word: string): Promise<string> {
        const model = this.aiProviderService.getModel('dictionary');
        if (!model) {
            throw new Error('词典 AI 模型未配置，请先在设置中配置词典模型');
        }

        const schema = z.object({
            translate: z.string().describe('单词的简明中文释义'),
        });

        const result = await concurrency.withRateLimit('gpt', () =>
            generateText({
                model,
                reasoning: 'low',
                output: Output.object({ schema }),
                prompt: this.buildDefinitionPrompt(word),
                maxRetries: 0,
                timeout: DEFINITION_REQUEST_TIMEOUT_MS,
            }));

        const translate = result.output?.translate?.trim();
        if (!translate) {
            throw new Error('AI 未返回有效释义');
        }
        return translate;
    }

    /**
     * 构建单词本释义生成提示词。
     *
     * @param word 查询单词。
     * @returns 提示词文本。
     */
    private buildDefinitionPrompt(word: string): string {
        return [
            '你是一位专业的英汉词典助手。',
            `请为英文单词 "${word}" 写一条适合记入单词本的简明中文释义。`,
            '',
            '要求：',
            '1. 覆盖该词最常用的 1-3 个含义；',
            '2. 每个义项以词性缩写开头（如 n.、v.、adj. 等），义项之间用中文分号分隔；',
            '3. 总长度不超过 60 个字，语言精炼，不要例句，不要额外解释；',
            // 提示词必须出现 "JSON" 字样：json_object 模式下部分兼容端点（如 uniapi 的
            // deepseek-v4-flash）会校验这一点，缺失时直接 400，收藏单词整体失败。
            '4. 以 JSON 格式输出，结果放入 translate 字段。'
        ].join('\n');
    }

    /**
     * 词表发生变化后失效相关缓存，保证生词高亮与分析结果及时更新。
     */
    private invalidateVocabularyCaches(): void {
        this.wordMatchService.invalidateVocabularyCache();
        this.subtitleService.invalidateVocabularyAnalysisCache();
        this.videoLearningService.invalidateClipAnalysisCache();
    }
}

/** 释义生成请求超时时间（毫秒）。 */
const DEFINITION_REQUEST_TIMEOUT_MS = 30_000;
