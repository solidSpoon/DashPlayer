import { words } from '@/backend/db/tables/words';

export interface GetAllWordsParams {
    search?: string;
    page?: number;
    pageSize?: number;
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
}