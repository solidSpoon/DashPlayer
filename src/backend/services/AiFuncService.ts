import { ZodObject } from 'zod';

export default interface AiFuncService {
    run(taskId: number, resultSchema: ZodObject<any>, promptStr: string): Promise<void>;
}
