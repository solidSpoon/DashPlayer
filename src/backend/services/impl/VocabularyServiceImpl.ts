import { words } from '@/backend/db/tables/words';
import { eq, like, or } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { injectable } from 'inversify';
import db from '@/backend/db';
import VocabularyService, { GetAllWordsParams, GetAllWordsResult, ExportTemplateResult, ImportWordsResult } from '@/backend/services/VocabularyService';

@injectable()
export default class VocabularyServiceImpl implements VocabularyService {

    async getAllWords(params: GetAllWordsParams = {}): Promise<GetAllWordsResult> {
        try {
            let query = db
                .select({
                    id: words.id,
                    word: words.word,
                    stem: words.stem,
                    translate: words.translate,
                    note: words.note,
                    created_at: words.created_at,
                    updated_at: words.updated_at
                })
                .from(words);

            // 添加搜索条件
            if (params.search) {
                const searchTerm = `%${params.search}%`;
                query = query.where(
                    or(
                        like(words.word, searchTerm),
                        like(words.translate, searchTerm),
                        like(words.stem, searchTerm)
                    )
                );
            }

            // 添加分页
            if (params.page && params.pageSize) {
                const offset = (params.page - 1) * params.pageSize;
                query = query.limit(params.pageSize).offset(offset);
            }

            const wordsResult = await query;

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
            console.error('获取单词失败:', error);
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
            const ws = XLSX.utils.json_to_sheet(templateData);

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
            console.error('导出模板失败:', error);
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
                const existingWords = await db
                    .select()
                    .from(words)
                    .where(eq(words.word, wordText))
                    .limit(1);

                if (existingWords.length > 0) {
                    // 更新现有记录
                    await db
                        .update(words)
                        .set({
                            translate: translate || null,
                            stem: stemText,
                            updated_at: now
                        })
                        .where(eq(words.word, wordText));
                    updateCount++;
                } else {
                    // 添加新记录
                    await db
                        .insert(words)
                        .values({
                            word: wordText,
                            translate: translate || null,
                            stem: stemText,
                            created_at: now,
                            updated_at: now
                        });
                    addCount++;
                }
            }

            return {
                success: true,
                message: `导入完成：更新 ${updateCount} 条，新增 ${addCount} 条`
            };
        } catch (error) {
            console.error('导入单词失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '导入单词失败'
            };
        }
    }
}