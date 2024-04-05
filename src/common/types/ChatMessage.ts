import { MessageType } from '@langchain/core/dist/messages';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface ChatMessageMiddle {
    type: MessageType;
    content: string;
}

export const toMsgMiddle = (msg: BaseMessage): ChatMessageMiddle => {
    let type: MessageType = 'system';
    if (msg instanceof HumanMessage) {
        type = 'human';
    } else if (msg instanceof AIMessage) {
        type = 'ai';
    }
    return {
        type: type,
        content: msg.content as string
    };
}

export const fromMsgMiddle = (msg: ChatMessageMiddle): BaseMessage => {
    switch (msg.type) {
        case 'human':
            return new HumanMessage(msg.content);
        case 'system':
            return new SystemMessage(msg.content);
        case 'ai':
            return new AIMessage(msg.content);
        default:
            return new SystemMessage(msg.content);
    }
}
