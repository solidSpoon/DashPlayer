import DpTaskService from '@/backend/services/DpTaskService';
import TtsService from '@/backend/controllers/TtsService';
import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import AiFuncService from "@/backend/services/AiFuncService";

export default class AiFuncController implements Controller {

    public async analyzeNewWords(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.analyzeWord(taskId, sentence).then();
        return taskId;
    }

    public async analyzeNewPhrases(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.analyzePhrase(taskId, sentence).then();
        return taskId;
    }

    public async analyzeGrammers(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.analyzeGrammer(taskId, sentence).then();
        return taskId;
    }

    public async makeSentences({sentence, point}: { sentence: string, point: string[] }) {
        const taskId = await DpTaskService.create();
        AiFuncService.makeSentences(taskId, sentence, point).then();
        return taskId;
    }

    public async synonymousSentence(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.synonymousSentence(taskId, sentence).then();
        return taskId;
    }

    public async phraseGroup(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.phraseGroup(taskId, sentence).then();
        return taskId;
    }

    public async punctuation({no, srt}: { no: number, srt: string }) {
        const taskId = await DpTaskService.create();
        AiFuncService.punctuation(taskId, no, srt).then();
        return taskId;
    }

    public async tts(string: string) {
        return TtsService.tts(string);
    }

    registerRoutes(): void {
        registerRoute('ai-func/analyze-new-words', this.analyzeNewWords);
        registerRoute('ai-func/analyze-new-phrases', this.analyzeNewPhrases);
        registerRoute('ai-func/analyze-grammars', this.analyzeGrammers);
        registerRoute('ai-func/make-example-sentences', this.makeSentences);
        registerRoute('ai-func/punctuation', this.punctuation);
        registerRoute('ai-func/synonymous-sentence', this.synonymousSentence);
        registerRoute('ai-func/phrase-group', this.phraseGroup);
        registerRoute('ai-func/tts', this.tts);
    }
}

