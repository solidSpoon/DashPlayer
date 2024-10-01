import analyzeWordsPrompt from '@/backend/services/prompts/analyze-word';
import { z } from 'zod';
import exampleSentences from '@/backend/services/prompts/example-sentence';
import analyzePhrasesPrompt from './prompts/analyze-phrases';
import synonymousSentence from '@/backend/services/prompts/synonymous-sentence';
import { AiFuncPolishPrompt } from '@/common/types/aiRes/AiFuncPolish';
import { AiAnalyseGrammarsPrompt } from '@/common/types/aiRes/AiAnalyseGrammarsRes';
import { AiFuncExplainSelectWithContextPrompt } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';
import { AiFuncExplainSelectPrompt } from '@/common/types/aiRes/AiFuncExplainSelectRes';
import { AiFuncFormatSplitPrompt } from '@/common/types/aiRes/AiFuncFormatSplit';
import { AiPhraseGroupPrompt } from '@/common/types/aiRes/AiPhraseGroupRes';
import { AiFuncTranslateWithContextPrompt } from '@/common/types/aiRes/AiFuncTranslateWithContextRes';
import { AiFuncPunctuationPrompt } from '@/common/types/aiRes/AiPunctuationResp';
import { getSubtitleContent, srtSlice } from '@/common/utils/srtSlice';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import AiFuncServiceImpl from '@/backend/services/AiFuncServiceImpl';
import ChatService from '@/backend/services/ChatService';
import { HumanMessage } from '@langchain/core/messages';

export interface AiService {
    polish(taskId: number, sentence: string): Promise<void>;

    formatSplit(taskId: number, text: string): Promise<void>;

    analyzeWord(taskId: number, sentence: string): Promise<void>;

    analyzePhrase(taskId: number, sentence: string): Promise<void>;

    analyzeGrammar(taskId: number, sentence: string): Promise<void>;

    makeSentences(taskId: number, sentence: string, point: string[]): Promise<void>;

    synonymousSentence(taskId: number, sentence: string): Promise<void>;

    phraseGroup(taskId: number, sentence: string): Promise<void>;

    punctuation(taskId: number, no: number, fullSrt: string): Promise<void>;

    explainSelect(taskId: number, word: string): Promise<void>;

    explainSelectWithContext(taskId: number, sentence: string, selectedWord: string): Promise<void>;

    translateWithContext(taskId: number, sentence: string, context: string[]): Promise<void>;
}

@injectable()
export default class AiServiceImpl implements AiService {

    @inject(TYPES.AiFuncService)
    private aiFuncService!: AiFuncServiceImpl;

    @inject(TYPES.ChatService)
    private chatService!: ChatService;

    public async polish(taskId: number, sentence: string) {
        await this.aiFuncService.run(taskId, AiFuncPolishPrompt.schema, AiFuncPolishPrompt.promptFunc(sentence));
    }

    public async formatSplit(taskId: number, text: string) {
        // await AiFunc.run(taskId, null, AiFuncFormatSplitPrompt.promptFunc(text));
        await this.chatService.chat(taskId, [new HumanMessage(AiFuncFormatSplitPrompt.promptFunc(text))]);
    }

    public async analyzeWord(taskId: number, sentence: string) {
        const schema = z.object({
            hasNewWord: z.boolean().describe('是否包含中等难度及以上的单词'),
            words: z.array(
                z.object({
                    word: z.string().describe('The word'),
                    phonetic: z.string().describe('The phonetic of the word'),
                    meaning: z.string().describe('The meaning of the word in Chinese(简体中文)')
                })
            ).describe('A list of new words for an intermediate English speaker, if none, it should be an empty list')
        });
        await this.aiFuncService.run(taskId, schema, analyzeWordsPrompt(sentence));
    }

    public async analyzePhrase(taskId: number, sentence: string) {
        const schema = z.object({
            hasPhrase: z.boolean().describe('这个句子是否包含 短语/词组/固定搭配'),
            phrases: z.array(
                z.object({
                    phrase: z.string().describe('短语/词组/固定搭配'),
                    meaning: z.string().describe('The meaning of the phrase in Chinese(简体中文)')
                })
            ).describe('A list of phrases for an intermediate English speaker, if none, it should be an empty list')
        });

        await this.aiFuncService.run(taskId, schema, analyzePhrasesPrompt(sentence));
    }

    public async analyzeGrammar(taskId: number, sentence: string) {

        //去掉换行
        sentence = sentence.replaceAll(/\n/g, ' ');
        const promptStr = AiAnalyseGrammarsPrompt.promptFunc(sentence);
        console.log('promptStr', promptStr);
        await this.aiFuncService.run(taskId, AiAnalyseGrammarsPrompt.schema, promptStr);
    }

    public async makeSentences(taskId: number, sentence: string, point: string[]) {
        const schema = z.object({
            sentences: z.array(
                z.object({
                    sentence: z.string().describe('The example sentence'),
                    meaning: z.string().describe('The meaning of the sentence in Chinese(简体中文)'),
                    points: z.array(z.string().describe('related points in the sentence'))
                })
            ).describe('A list of example sentences for an intermediate English speaker. length should be 5')
        });

        await this.aiFuncService.run(taskId, schema, exampleSentences(point));

    }

    public async synonymousSentence(taskId: number, sentence: string) {
        const schema = z.object({
            sentences: z.array(z.string()).describe('A list of synonymous sentences for the input sentence, length should be 3')
        });
        await this.aiFuncService.run(taskId, schema, synonymousSentence(sentence));
    }

    /**
     * 意群
     * @param taskId
     * @param sentence
     */
    public async phraseGroup(taskId: number, sentence: string) {
        await this.aiFuncService.run(taskId, AiPhraseGroupPrompt.schema, AiPhraseGroupPrompt.promptFunc(sentence));
    }


    /**
     * 断句
     * 当前字幕行所在的句子可能被换行打断, 尝试找出完整的句子
     * @param taskId
     * @param no
     * @param fullSrt
     */
    public async punctuation(taskId: number, no: number, fullSrt: string) {
        const sentence = getSubtitleContent(fullSrt, no) ?? '';
        const srt = srtSlice(fullSrt, no, 5);
        await this.aiFuncService.run(taskId, AiFuncPunctuationPrompt.schema, AiFuncPunctuationPrompt.promptFunc(sentence, srt));
    }

    public async explainSelect(taskId: number, word: string) {
        await this.aiFuncService.run(taskId, AiFuncExplainSelectPrompt.schema, AiFuncExplainSelectPrompt.promptFunc(word));

    }

    public async explainSelectWithContext(taskId: number, sentence: string, selectedWord: string) {
        await this.aiFuncService.run(taskId, AiFuncExplainSelectWithContextPrompt.schema, AiFuncExplainSelectWithContextPrompt.promptFunc(sentence, selectedWord));
    }

    public async translateWithContext(taskId: number, sentence: string, context: string[]) {
        await this.aiFuncService.run(taskId, AiFuncTranslateWithContextPrompt.schema, AiFuncTranslateWithContextPrompt.promptFunc(sentence, context));
    }
}

