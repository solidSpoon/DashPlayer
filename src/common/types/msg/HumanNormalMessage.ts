import {BaseMessage} from "@langchain/core/messages";
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import MsgT from "@/common/types/msg/interfaces/MsgT";

class HumanNormalMessage implements CustomMessage<HumanNormalMessage> {
    content: string;

    constructor(content: string) {
        this.content = content;
    }

    toMsg(): MsgT[] {
        return [{
            type: "human",
            content: this.content
        }]
    }


    copy(): HumanNormalMessage {
        return new HumanNormalMessage(this.content);
    }

    msgType: MsgType = "human-normal";
}
