import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";


class HumanTopicMessage implements CustomMessage<HumanTopicMessage> {
    public content: string;
    public phraseGroupTask: number;
    constructor(text: string, phraseGroupTask: number) {
        this.content = text;
        this.phraseGroupTask = phraseGroupTask;
    }

    public toMsg(): MsgT[] {
        return [{
            type: "human",
            content: `请帮我分析 "${this.content}"`,
        }];
    }
    msgType: MsgType = "human-topic";

    copy(): HumanTopicMessage {
        return new HumanTopicMessage(this.content, this.phraseGroupTask);
    }
}

export default HumanTopicMessage;
