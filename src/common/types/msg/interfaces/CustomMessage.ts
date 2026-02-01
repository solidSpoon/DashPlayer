import { Topic } from '@/fronted/hooks/useChatPanel';
import { ModelMessage } from 'ai';

export default interface CustomMessage<T> {
    toMsg(): Promise<ModelMessage[]>;

    msgType: MsgType;

    copy(): T;

    getTopic(): Topic;

    getTaskIds(): number[];
}

export type MsgType =
    | 'human-topic'
    | 'human-normal'
    | 'ai-streaming'
