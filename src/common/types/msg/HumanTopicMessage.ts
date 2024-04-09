import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import MsgT from "@/common/types/msg/interfaces/MsgT";


class HumanTopicMessage implements CustomMessage<HumanTopicMessage> {
    public content: string;
    constructor(text: string) {
        this.content = text;
    }

    public toMsg(): MsgT[] {
        return [{
            type: "human",
            content: `请帮我分析 "${this.content}"`,
        }];
    }
    msgType: MsgType = "human-topic";

    copy(): HumanTopicMessage {
        return new HumanTopicMessage(this.content);
    }
}

export default HumanTopicMessage;
