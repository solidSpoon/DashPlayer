import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";
import { Topic } from '@/fronted/hooks/useChatPanel';


class HumanTopicMessage implements CustomMessage<HumanTopicMessage> {
    private readonly topic: Topic;
    public content: string;
    public phraseGroupTask: number;
    constructor(topic: Topic, text: string, phraseGroupTask: number) {
        this.topic = topic;
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
        return new HumanTopicMessage(this.topic, this.content, this.phraseGroupTask);
    }

    getTopic(): Topic {
        return this.topic;
    }
}

export default HumanTopicMessage;
