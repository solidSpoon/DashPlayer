import { ZodObject } from 'zod';
import { CoreMessage } from 'ai';

export default interface ChatService {
    chat(taskId: number, msgs: CoreMessage[]): Promise<void>;
    run(taskId: number, resultSchema: ZodObject<any>, promptStr: string): Promise<void>;
}


