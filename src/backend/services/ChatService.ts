import { BaseMessage } from '@langchain/core/messages';
import { ZodObject } from 'zod';

export default interface ChatService {
    chat(taskId: number, msgs: BaseMessage[]): Promise<void>;
    run(taskId: number, resultSchema: ZodObject<any>, promptStr: string): Promise<void>;
}


