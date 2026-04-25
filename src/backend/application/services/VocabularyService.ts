export interface GetAllWordsParams {
    search?: string;
}

export interface GetAllWordsResult {
    success: boolean;
    data?: any[];
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
    /**
     * 将单词加入收藏生词本。
     *
     * @param params.word 单词原文（建议已归一化）。
     * @param params.translate 可选释义。
     * @returns 操作结果。
     */
    addWord(params: { word: string; translate?: string }): Promise<{ success: boolean; message?: string }>;

    /**
     * 从生词本中删除选定单词。
     * @param word 单词原文。
     */
    deleteWord(word: string): Promise<{ success: boolean; message?: string }>;

    /**
     * 重新获取并刷新指定单词的翻译。
     * @param word 单词原文。
     */
    refreshWordTranslation(word: string): Promise<{ success: boolean; translate?: string; message?: string }>;
}
