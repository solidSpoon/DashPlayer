import {AIMessage, BaseMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";

interface MsgT {
    type: 'ai' | 'human' | 'system';
    content: string;
}


const toLangChainMsg = (msg: MsgT): BaseMessage => {
    switch (msg.type) {
        case 'ai':
            return new AIMessage(msg.content);
        case 'human':
            return new HumanMessage(msg.content);
        case "system":
            return new SystemMessage(msg.content);
        default:
            return new SystemMessage(msg.content);
    }
}

export {MsgT, toLangChainMsg};
