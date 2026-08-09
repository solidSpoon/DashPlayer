import { ZodType } from 'zod';
import { ModelMessage } from 'ai';

export default interface ChatService {
    chat(taskId: number, msgs: ModelMessage[]): Promise<void>;
    run(taskId: number, resultSchema: ZodType, promptStr: string): Promise<void>;
}
