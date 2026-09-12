import Controller from '@/backend/controllers/Controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import VocabularyService, {GetAllWordsParams, UpdateWordParams} from '@/backend/services/VocabularyService';
import SentenceVocabularyService from '@/backend/services/SentenceVocabularyService';
import type { SentenceVocabularyVO } from '@/common/types/vo/SentenceVocabularyVO';
import registerRoute from '@/backend/controllers/ipc/registerRoute';

@injectable()
export default class VocabularyController implements Controller {
    @inject(TYPES.VocabularyService) private vocabularyService!: VocabularyService;
    @inject(TYPES.SentenceVocabularyService) private sentenceVocabularyService!: SentenceVocabularyService;

    public async getAllWords(params: GetAllWordsParams = {}) {
        return this.vocabularyService.getAllWords(params);
    }

    public async exportTemplate() {
        return this.vocabularyService.exportTemplate();
    }

    public async importWords(params: { filePath: string }) {
        return this.vocabularyService.importWords(params.filePath);
    }

    public async favoriteWord(params: { word: string; translate?: string }) {
        return this.vocabularyService.favoriteWord(params.word, params.translate);
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

    /**
     * 选出一个句子里值得重点认识的生词，并返回句内逐词释义。
     *
     * 说明：全程只读本地词典，不调用模型、不访问网络。
     *
     * @param params.text 目标句子原文。
     * @returns 生词列表与句内逐词释义映射。
     */
    public async pickSentenceVocabulary(params: { text: string }): Promise<SentenceVocabularyVO> {
        return this.sentenceVocabularyService.pick(params.text);
    }

    registerRoutes(): void {
        registerRoute('vocabulary/get-all', (p) => this.getAllWords(p));
        registerRoute('vocabulary/export-template', () => this.exportTemplate());
        registerRoute('vocabulary/import', (p) => this.importWords(p));
        registerRoute('vocabulary/favorite', (p) => this.favoriteWord(p));
        registerRoute('vocabulary/update', (p) => this.updateWord(p));
        registerRoute('vocabulary/delete', (p) => this.deleteWord(p));
        registerRoute('vocabulary/generate-definition', (p) => this.generateDefinition(p));
        registerRoute('vocabulary/pick-sentence', (p) => this.pickSentenceVocabulary(p));
    }
}
