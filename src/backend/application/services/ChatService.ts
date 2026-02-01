import { ZodObject } from 'zod';
import { ModelMessage } from 'ai';

export default interface ChatService {
    chat(taskId: number, msgs: ModelMessage[]): Promise<void>;
    run(taskId: number, resultSchema: ZodObject<any>, promptStr: string): Promise<void>;
}

