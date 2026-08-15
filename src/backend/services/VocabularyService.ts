import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import { WordMatchService } from '@/backend/services/WordMatchService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import WordsRepository from '@/backend/services/repositories/WordsRepository';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { loadDefaultVocabulary } from '@/backend/utils/defaultVocabulary';
import SubtitleService from '@/backend/services/SubtitleService';

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

export default interface VocabularyService {
    getAllWords(params: GetAllWordsParams): Promise<GetAllWordsResult>;
    exportTemplate(): Promise<ExportTemplateResult>;
    importWords(filePath: string): Promise<ImportWordsResult>;
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

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

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
     * - 以单词为键去重，后出现的行覆盖前面的内容。
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

            const wordText = english.trim();
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
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
            const fileBuffer = await fs.readFile(filePath);
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
}
