import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import { Topic } from '@/fronted/hooks/useChatPanel';
import { CoreMessage } from 'ai';

class HumanNormalMessage implements CustomMessage<HumanNormalMessage> {
    public content: string;
    private readonly topic: Topic ;
    constructor(topic:Topic, content: string) {
        this.topic = topic;
        this.content = content;
    }

    async toMsg(): Promise<CoreMessage[]> {
        return [{
            role: "user",
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

    getTaskIds(): number[] {
        return [];
    }
}


export default HumanNormalMessage;
