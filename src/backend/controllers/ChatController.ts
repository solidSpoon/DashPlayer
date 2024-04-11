import {BaseMessage} from '@langchain/core/messages';
import ChatService from '@/backend/services/ChatService';
import DpTaskService from '@/backend/services/DpTaskService';
import {AnalyzeSentenceParams} from '@/common/types/aiRes/AnalyzeSentenceParams';
import TtsService from '@/backend/controllers/TtsService';

export default class ChatController {
    public static async chat(msgs: BaseMessage[]): Promise<number> {
        const taskId = await DpTaskService.create();
        ChatService.chat(taskId, msgs).then();
        return taskId;
    }

    public static async analyzeSentence(params: AnalyzeSentenceParams) {
        const taskId = await DpTaskService.create();
        ChatService.analyzeSentence(taskId, params).then();
        return taskId;
    }

    public static async analyzeNewWords(sentence: string) {
        const taskId = await DpTaskService.create();
        ChatService.analyzeWord(taskId, sentence).then();
        return taskId;
    }

    public static async analyzeNewPhrases(sentence: string) {
        const taskId = await DpTaskService.create();
        ChatService.analyzePhrase(taskId, sentence).then();
        return taskId;
    }
    public static async analyzeGrammers(sentence: string) {
        const taskId = await DpTaskService.create();
        ChatService.analyzeGrammer(taskId, sentence).then();
        return taskId;
    }

    public static async makeSentences(sentence: string, point: string[]) {
        const taskId = await DpTaskService.create();
        ChatService.makeSentences(taskId, sentence, point).then();
        return taskId;
    }
    public static async synonymousSentence(sentence: string) {
        const taskId = await DpTaskService.create();
        ChatService.synonymousSentence(taskId, sentence).then();
        return taskId;
    }
    public static async phraseGroup(sentence: string,phraseGroup?: string) {
        const taskId = await DpTaskService.create();
        ChatService.phraseGroup(taskId, sentence, phraseGroup).then();
        return taskId;
    }

    public static async punctuation(no: number, srt: string) {
        const taskId = await DpTaskService.create();
        ChatService.punctuation(taskId, no, srt).then();
        return taskId;
    }

    public static async tts(string: string) {
        return TtsService.tts(string);
    }
}
