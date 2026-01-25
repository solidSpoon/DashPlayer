import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/adapters/controllers/Controller';
import TYPES from '@/backend/ioc/types';
import AiFuncService from '@/backend/application/services/impl/AiFuncService';

@injectable()
export default class AiFuncController implements Controller {

    @inject(TYPES.AiFuncService)
    private aiFuncService!: AiFuncService;


    registerRoutes(): void {
        registerRoute('ai-func/analyze-new-words', (p) => this.aiFuncService.analyzeNewWords(p));
        registerRoute('ai-func/analyze-new-phrases', (p) => this.aiFuncService.analyzeNewPhrases(p));
        registerRoute('ai-func/analyze-grammars', (p) => this.aiFuncService.analyzeGrammars(p));
        registerRoute('ai-func/make-example-sentences', (p) => this.aiFuncService.makeSentences(p));
        registerRoute('ai-func/punctuation', (p) => this.aiFuncService.punctuation(p));
        registerRoute('ai-func/format-split', (p) => this.aiFuncService.formatSplit(p));
        registerRoute('ai-func/phrase-group', (p) => this.aiFuncService.phraseGroup(p));
        registerRoute('ai-func/tts', (p) => this.aiFuncService.tts(p));
        registerRoute('ai-func/transcript', (p) => this.aiFuncService.transcript(p));
        registerRoute('ai-func/cancel-transcription', (p) => this.aiFuncService.cancelTranscription(p));
        registerRoute('ai-func/translate-with-context', (p) => this.aiFuncService.translateWithContext(p));
    }
}
