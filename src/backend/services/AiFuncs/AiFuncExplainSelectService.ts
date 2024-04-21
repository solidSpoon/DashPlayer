
import AiFunc from '@/backend/services/AiFuncs/ai-func';
import { AiFuncExplainSelectWithContextPrompt } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';

export default class AiFuncExplainSelectService {
    public static async run(taskId: number, sentence: string, selectedWord: string) {
        await AiFunc.run(taskId, AiFuncExplainSelectWithContextPrompt.schema, AiFuncExplainSelectWithContextPrompt.promptFunc(sentence, selectedWord));
    }
}

