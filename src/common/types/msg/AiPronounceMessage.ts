import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {BaseMessage} from "@langchain/core/messages";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";

class AiPronounceMessage implements CustomMessage<AiPronounceMessage> {
    constructor() {

    }

    toMsg(): MsgT[] {
        return [];
    }


    copy(): AiPronounceMessage {
        return new AiPronounceMessage();
    }

    msgType: MsgType = "ai-pronounce";
}
