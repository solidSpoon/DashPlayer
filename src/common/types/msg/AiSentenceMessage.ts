
import {AiMakeExampleSentencesRes} from "@/common/types/AiMakeExampleSentencesRes";
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import MsgT from "@/common/types/msg/interfaces/MsgT";

class AiSentenceMessage implements CustomMessage<AiSentenceMessage> {
    private res: AiMakeExampleSentencesRes;

    constructor(prop: AiMakeExampleSentencesRes) {
        this.res = prop;
    }

    public toMsg(): MsgT[] {
        return [];
    }

    copy(): AiSentenceMessage {
        return new AiSentenceMessage(this.res);
    }

    msgType: MsgType =  "ai-sentence";
}


export default AiSentenceMessage;
