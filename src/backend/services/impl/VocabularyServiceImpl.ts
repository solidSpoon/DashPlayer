import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, { GetAllWordsParams, GetAllWordsResult, ExportTemplateResult, ImportWordsResult } from '@/backend/services/VocabularyService';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import WordsRepository from '@/backend/infrastructure/db/repositories/WordsRepository';

@injectable()
export default class VocabularyServiceImpl implements VocabularyService {

    @inject(TYPES.VideoLearningService)
    private videoLearningService!: VideoLearningService;

    @inject(TYPES.WordsRepository)
    private wordsRepository!: WordsRepository;

    private readonly logger = getMainLogger('VocabularyServiceImpl');

    async getAllWords(params: GetAllWordsParams = {}): Promise<GetAllWordsResult> {
        try {
            const wordsResult = await this.wordsRepository.getAll({ search: params.search });

            return {
                success: true,
                data: wordsResult.map(word => ({
                    id: word.id,
                    word: word.word,
                    stem: word.stem || '',
                    translate: word.translate || '',
                    note: word.note || '',
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

    async exportTemplate(): Promise<ExportTemplateResult> {
        try {
            // 获取所有现有单词作为模板
            const wordsResult = await this.getAllWords();

            if (!wordsResult.success || !wordsResult.data) {
                return {
                    success: false,
                    error: wordsResult.error || '获取单词数据失败'
                };
            }

            // 转换为Excel格式，只包含英文和释义
            const templateData = wordsResult.data.map(word => ({
                英文: word.word,
                释义: word.translate || ''
            }));

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const headers = ['英文', '释义'];
            const ws = templateData.length > 0
                ? XLSX.utils.json_to_sheet(templateData, { header: headers })
                : XLSX.utils.aoa_to_sheet([headers]);

            // 设置列宽
            ws['!cols'] = [
                { wch: 25 }, // 英文
                { wch: 50 }  // 释义
            ];

            XLSX.utils.book_append_sheet(wb, ws, '单词管理');

            // 转换为二进制数据
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

    async importWords(filePath: string): Promise<ImportWordsResult> {
        try {
            // 读取Excel文件
            const fileBuffer = await fs.readFile(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

            // 获取第一个工作表
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // 转换为JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // 处理导入数据
            let updateCount = 0;
            let addCount = 0;

            for (const row of jsonData as any[]) {
                const english = row['英文'] || row['word'] || row['Word'];
                const translate = row['释义'] || row['translate'] || row['Translation'];

                if (!english || typeof english !== 'string' || english.trim() === '') {
                    continue; // 跳过无效数据
                }

                const wordText = english.trim();
                const stemText = wordText; // 词干默认复制英文
                const now = new Date().toISOString();

                // 检查是否已存在
                const existingWordId = await this.wordsRepository.findIdByWord(wordText);

                if (existingWordId) {
                    // 更新现有记录
                    await this.wordsRepository.updateByWord(wordText, {
                        translate: translate || null,
                        stem: stemText,
                        updated_at: now,
                    });
                    updateCount++;
                } else {
                    // 添加新记录
                    await this.wordsRepository.insert({
                        word: wordText,
                        translate: translate || null,
                        stem: stemText,
                        created_at: now,
                        updated_at: now,
                    });
                    addCount++;
                }
            }

            try {
                await this.videoLearningService.syncFromOss();
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
                message: `导入完成：更新 ${updateCount} 条，新增 ${addCount} 条，已同步单词管理片段`
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
