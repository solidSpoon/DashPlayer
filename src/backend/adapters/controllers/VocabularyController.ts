import Controller from '@/backend/adapters/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, {GetAllWordsParams} from '@/backend/application/services/VocabularyService';
import registerRoute from '@/backend/adapters/ipc/registerRoute';

@injectable()
export default class VocabularyController implements Controller {
    @inject(TYPES.VocabularyService) private vocabularyService!: VocabularyService;

    public async getAllWords(params: GetAllWordsParams = {}) {
        return this.vocabularyService.getAllWords(params);
    }

    public async exportTemplate() {
        return this.vocabularyService.exportTemplate();
    }

    public async importWords(params: { filePath: string }) {
        return this.vocabularyService.importWords(params.filePath);
    }

    public async addWord(params: { word: string; translate?: string }) {
        return this.vocabularyService.addWord(params);
    }

    public async deleteWord(params: { word: string }) {
        return this.vocabularyService.deleteWord(params.word);
    }

    public async refreshTranslation(params: { word: string }) {
        return this.vocabularyService.refreshWordTranslation(params.word);
    }

    registerRoutes(): void {
        registerRoute('vocabulary/get-all', (p) => this.getAllWords(p));
        registerRoute('vocabulary/export-template', () => this.exportTemplate());
        registerRoute('vocabulary/import', (p) => this.importWords(p));
        registerRoute('vocabulary/add', (p) => this.addWord(p));
        registerRoute('vocabulary/delete', (p) => this.deleteWord(p));
        registerRoute('vocabulary/refresh-translation', (p) => this.refreshTranslation(p));
    }
}
