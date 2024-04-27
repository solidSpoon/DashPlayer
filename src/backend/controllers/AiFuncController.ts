import DpTaskService from '@/backend/services/DpTaskService';
import TtsService from '@/backend/services/TtsService';
import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import AiFuncService from "@/backend/services/AiFuncService";
import ChatService from "@/backend/services/ChatService";
import {MsgT, toLangChainMsg} from "@/common/types/msg/interfaces/MsgT";
import WhisperService from "@/backend/services/WhisperService";
import AiFuncExplainSelectService from '@/backend/services/AiFuncs/AiFuncExplainSelectService';

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

    public async analyzeGrammars(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.analyzeGrammar(taskId, sentence).then();
        return taskId;
    }

    public async makeSentences({sentence, point}: { sentence: string, point: string[] }) {
        const taskId = await DpTaskService.create();
        AiFuncService.makeSentences(taskId, sentence, point).then();
        return taskId;
    }

    public async polish(sentence: string) {
        const taskId = await DpTaskService.create();
        AiFuncService.polish(taskId, sentence).then();
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
        return `dp-local:///${await TtsService.tts(string)}`;
    }

    public static async chat({msgs}: { msgs: MsgT[] }): Promise<number> {
        const taskId = await DpTaskService.create();
        const ms = msgs.map((msg) => toLangChainMsg(msg));
        ChatService.chat(taskId, ms).then();
        return taskId;
    }

    public static async transcript({filePath}:{filePath: string}) {
        const taskId = await DpTaskService.create();
        console.log('taskId', taskId);
        WhisperService.transcript(taskId, filePath).then(r => {
            console.log(r);
        });
        return taskId;
    }
    public static async explainSelectWithContext({sentence, selectedWord}: { sentence: string, selectedWord: string }) {
        const taskId = await DpTaskService.create();
        AiFuncExplainSelectService.run(taskId, sentence, selectedWord).then();
        return taskId;
    }
    public static async explainSelect({word}: { word: string }) {
        const taskId = await DpTaskService.create();
        AiFuncService.explainSelect(taskId, word).then();
        return taskId;
    }
    registerRoutes(): void {
        registerRoute('ai-func/analyze-new-words', this.analyzeNewWords);
        registerRoute('ai-func/analyze-new-phrases', this.analyzeNewPhrases);
        registerRoute('ai-func/analyze-grammars', this.analyzeGrammars);
        registerRoute('ai-func/make-example-sentences', this.makeSentences);
        registerRoute('ai-func/punctuation', this.punctuation);
        registerRoute('ai-func/polish', this.polish);
        registerRoute('ai-func/phrase-group', this.phraseGroup);
        registerRoute('ai-func/tts', this.tts);
        registerRoute('ai-func/chat', AiFuncController.chat);
        registerRoute('ai-func/transcript', AiFuncController.transcript);
        registerRoute('ai-func/explain-select-with-context', AiFuncController.explainSelectWithContext);
        registerRoute('ai-func/explain-select', AiFuncController.explainSelect);
    }
}

