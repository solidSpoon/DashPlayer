import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, {GetAllWordsParams, UpdateWordParams} from '@/backend/services/VocabularyService';
import registerRoute from '@/backend/controllers/ipc/registerRoute';

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

    public async favoriteWord(params: { word: string }) {
        return this.vocabularyService.favoriteWord(params.word);
    }

    public async updateWord(params: UpdateWordParams) {
        return this.vocabularyService.updateWord(params);
    }

    public async deleteWord(params: { word: string }) {
        return this.vocabularyService.deleteWord(params.word);
    }

    public async generateDefinition(params: { word: string }) {
        return this.vocabularyService.generateDefinition(params.word);
    }

    registerRoutes(): void {
        registerRoute('vocabulary/get-all', (p) => this.getAllWords(p));
        registerRoute('vocabulary/export-template', () => this.exportTemplate());
        registerRoute('vocabulary/import', (p) => this.importWords(p));
        registerRoute('vocabulary/favorite', (p) => this.favoriteWord(p));
        registerRoute('vocabulary/update', (p) => this.updateWord(p));
        registerRoute('vocabulary/delete', (p) => this.deleteWord(p));
        registerRoute('vocabulary/generate-definition', (p) => this.generateDefinition(p));
    }
}
