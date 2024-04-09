import {BaseMessage} from "@langchain/core/messages";
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import MsgT from "@/common/types/msg/interfaces/MsgT";

class AiNormalMessage implements CustomMessage<AiNormalMessage> {
    private content: string;
    constructor(content:string) {
    }
    toMsg(): MsgT[] {
        return [{
            type: "ai",
            content: this.content
        }];
    }
    msgType: MsgType =  "ai-normal";

    copy(): AiNormalMessage {
        return new AiNormalMessage(this.content);
    }
}

export default AiNormalMessage;
