
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import MsgT from "@/common/types/msg/interfaces/MsgT";

class AiMeaningMessage implements CustomMessage<AiMeaningMessage> {
    constructor() {
    }
    toMsg(): MsgT[] {
        return [];
    }
    msgType: MsgType =  "ai-meaning";

    copy(): AiMeaningMessage {
        return new AiMeaningMessage();
    }
}

export default AiMeaningMessage;
