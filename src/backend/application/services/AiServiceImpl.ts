import { AiFuncFormatSplitPrompt } from '@/common/types/aiRes/AiFuncFormatSplit';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import ChatService from '@/backend/application/services/ChatService';

export interface AiService {
    formatSplit(taskId: number, text: string): Promise<void>;
}

@injectable()
export default class AiServiceImpl implements AiService {

    @inject(TYPES.ChatService)
    private chatService!: ChatService;

    public async formatSplit(taskId: number, text: string) {
        // await AiFunc.run(taskId, null, AiFuncFormatSplitPrompt.promptFunc(text));
        await this.chatService.chat(taskId, [{
            role: 'user',
            content: AiFuncFormatSplitPrompt.promptFunc(text)
        }]);
    }
}
