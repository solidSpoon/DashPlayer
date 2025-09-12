import Controller from '@/backend/interfaces/controller';
import { injectable } from 'inversify';
import registerRoute from '@/common/api/register';
import { VocabularyController as VocabularyService } from './VocabularyController';

@injectable()
export default class VocabularyApiController implements Controller {
    private vocabularyService = VocabularyService.getInstance();

    public async getAllWords(params: any = {}) {
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