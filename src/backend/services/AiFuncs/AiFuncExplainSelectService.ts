
import AiFunc from '@/backend/services/AiFuncs/ai-func';
import { AiFuncExplainSelectPrompt } from '@/common/types/aiRes/AiFuncExplainSelectRes';

export default class AiFuncExplainSelectService {
    public static async run(taskId: number, sentence: string, selectedWord: string) {
        await AiFunc.run(taskId, AiFuncExplainSelectPrompt.schema, AiFuncExplainSelectPrompt.promptFunc(sentence, selectedWord));
    }
}

