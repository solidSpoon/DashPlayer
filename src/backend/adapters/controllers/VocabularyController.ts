import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, {GetAllWordsParams} from '@/backend/services/VocabularyService';
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

    registerRoutes(): void {
        registerRoute('vocabulary/get-all', (p) => this.getAllWords(p));
        registerRoute('vocabulary/export-template', () => this.exportTemplate());
        registerRoute('vocabulary/import', (p) => this.importWords(p));
    }
}
