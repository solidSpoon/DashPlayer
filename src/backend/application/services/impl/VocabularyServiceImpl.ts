import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, { GetAllWordsParams, GetAllWordsResult, ExportTemplateResult, ImportWordsResult } from '@/backend/application/services/VocabularyService';
import { VideoLearningService } from '@/backend/application/services/VideoLearningService';
import { WordMatchService } from '@/backend/application/services/WordMatchService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import WordsRepository from '@/backend/application/ports/repositories/WordsRepository';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import TranslateService from '@/backend/application/services/AiTransServiceImpl';
import { OpenAIDictionaryResult, YdRes } from '@/common/types/YdRes';

/**
 * 单词导入导出服务实现。
 */
@injectable()
export default class VocabularyServiceImpl implements VocabularyService {

    @inject(TYPES.VideoLearningService)
    private videoLearningService!: VideoLearningService;

    @inject(TYPES.WordsRepository)
    private wordsRepository!: WordsRepository;

    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.TranslateService)
    private translateService!: TranslateService;

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

        for (const row of jsonData as any[]) {
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
     * - 导出当前用户词表，作为后续导入的唯一数据源。
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

            const vocabularyRows = wordsResult.data.map(word => ({
                英文: word.word,
                释义: word.translate || ''
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, this.createVocabularyWorksheet(vocabularyRows), '单词管理');

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

    async addWord(params: { word: string; translate?: string }): Promise<{ success: boolean; message?: string }> {
        try {
            const normalized = params.word.trim().toLowerCase();
            if (!normalized) {
                return { success: false, message: '单词不能为空' };
            }
            await this.wordsRepository.addWord(normalized, params.translate);
            this.wordMatchService.invalidateVocabularyCache();
            return { success: true, message: `已将「${normalized}」加入生词本` };
        } catch (error) {
            this.logger.error('添加单词失败', { error });
            return { success: false, message: error instanceof Error ? error.message : '添加失败' };
        }
    }

    async deleteWord(word: string): Promise<{ success: boolean; message?: string }> {
        try {
            const normalized = word.trim().toLowerCase();
            await this.wordsRepository.deleteWord(normalized);
            this.wordMatchService.invalidateVocabularyCache();
            return { success: true, message: `已从生词本中删除「${normalized}」` };
        } catch (error) {
            this.logger.error('删除单词失败', { error });
            return { success: false, message: error instanceof Error ? error.message : '删除失败' };
        }
    }

    async refreshWordTranslation(word: string): Promise<{ success: boolean; translate?: string; message?: string }> {
        const normalized = word.trim().toLowerCase();
        try {
            this.logger.info(`[VocabularyService] 开始刷新单词释义: ${normalized}`);
            const result = await this.translateService.transWord(normalized, true);
            
            if (!result) {
                this.logger.warn(`[VocabularyService] 词典查询未返回结果: ${normalized}`);
                return { success: false, message: '未获取到词典释义' };
            }

            this.logger.debug(`[VocabularyService] 词典查询响应对象: ${normalized}`, { 
                hasTranslation: 'translation' in result,
                hasDefinitions: 'definitions' in result 
            });

            let formattedTranslate = '';
            // 兼容有道词典格式
            if ('translation' in (result as any) && Array.isArray((result as any).translation)) {
                formattedTranslate = (result as YdRes).translation.join('；');
            } 
            // 兼容 OpenAI 字典格式
            else if ('definitions' in (result as any) && Array.isArray((result as any).definitions)) {
                formattedTranslate = (result as OpenAIDictionaryResult).definitions
                    .map((d) => (d.partOfSpeech ? `[${d.partOfSpeech}] ${d.meaning}` : d.meaning))
                    .join('；');
            }

            if (!formattedTranslate) {
                this.logger.warn(`[VocabularyService] 无法从返回结果中解析出释义文本: ${normalized}`, { result });
                return { success: false, message: '无法解析获取到的释义内容' };
            }

            await this.wordsRepository.updateWord(normalized, formattedTranslate);
            this.logger.info(`[VocabularyService] 单词释义更新成功: ${normalized}`);
            
            return { success: true, translate: formattedTranslate, message: '释义已刷新' };
        } catch (error) {
            this.logger.error(`[VocabularyService] 刷新单词释义发生异常: ${normalized}`, { error });
            return { 
                success: false, 
                message: error instanceof Error ? `刷新请求失败: ${error.message}` : '连接字典服务失败，请重试' 
            };
        }
    }
}
