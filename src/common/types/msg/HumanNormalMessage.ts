import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";
import { Topic } from '@/fronted/hooks/useChatPanel';

class HumanNormalMessage implements CustomMessage<HumanNormalMessage> {
    public content: string;
    private readonly topic: Topic ;
    constructor(topic:Topic, content: string) {
        this.topic = topic;
        this.content = content;
    }

    async toMsg(): Promise<MsgT[]> {
        return [{
            type: "human",
            content: this.content
        }]
    }


    copy(): HumanNormalMessage {
        return new HumanNormalMessage(this.topic, this.content);
    }

    msgType: MsgType = "human-normal";

    getTopic(): Topic {
        return this.topic;
    }
}


export default HumanNormalMessage;
