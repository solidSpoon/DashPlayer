import { codeBlock, oneLine } from 'common-tags';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { MessageType } from '@langchain/core/dist/messages';
import ChatService from '@/backend/services/ChatService';
import { z } from 'zod';
import AiFunc from '@/backend/services/AiFuncs/ai-func';

const promptFunc = (text: string, selectedWord: string):[MessageType,string][] => [
    ['system', codeBlock`
${oneLine`
You are an expert in the semantic syntax of the English language,
and you are teaching me the English language.
I will give you a sentence in English and a word from that sentence.
Then, help me explain in Chinese what the word means in the sentence, what the sentence itself means,
and whether the word is part of an idiom in the sentence. If it is, explain the idiom in the sentence.
Provide 3 to 5 examples in English with the same meaning, and explain these examples in Chinese.
The answer should follow the format with func input.
`}

${oneLine`<word> · /<IPA>/ `}
${oneLine`<the remaining part>`}

If you understand, say "yes", and then we will begin.`],
    ['ai', 'Yes, I understand. Please give me the sentence and the word.'],
    ['human', `the sentence is: ${text}\n\nthe word is: ${selectedWord}`]];

export default class AiFuncExplainSelect {


    public static async run(taskId: number, sentence: string, selectedWord: string) {
        const prompt = ChatPromptTemplate.fromMessages(promptFunc(sentence, selectedWord));
        const promptValue = await prompt.invoke({});
        const schema = z.object({
            sentence: z.object({
                sentence: z.string().describe("The sentence"),
                meaning: z.string().describe("The meaning of the sentence in Chinese"),
            }),
            word: z.object({
                word: z.string().describe("The word"),
                phonetic: z.string().describe("The phonetic of the word"),
                meaning: z.string().describe("The meaning of the word in Chinese"),
                meaningInSentence: z.string().describe("The meaning of the word in the sentence"),
            }),
            idiom: z.object({
                idiom: z.string().describe("The idiom in the sentence"),
                meaning: z.string().describe("The meaning of the idiom in Chinese"),
            }).optional().describe("The idiom in the sentence"),
        });
        await AiFunc.run2(taskId, schema, promptValue.toChatMessages());
    }

}

