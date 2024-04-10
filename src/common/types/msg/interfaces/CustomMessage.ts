import {BaseMessage} from "@langchain/core/messages";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";

export default interface CustomMessage<T> {
    toMsg(): MsgT[];

    msgType: MsgType;

    copy(): T;
}

export type MsgType =
    | 'human-topic'
    | 'human-normal'
    | 'ai-welcome'
    | 'ai-sentence'
    | 'ai-meaning'
    | 'ai-streaming'
    | 'ai-normal'
    | 'ai-pronounce';
