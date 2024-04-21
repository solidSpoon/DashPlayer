import { BaseMessage } from '@langchain/core/messages';
import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import { Topic } from '@/fronted/hooks/useChatPanel';

class AiNormalMessage implements CustomMessage<AiNormalMessage> {
    public content: string;
    private readonly topic: Topic;

    constructor(topic: Topic, content: string) {
        this.content = content;
        this.topic = topic;
    }

    toMsg(): MsgT[] {
        return [{
            type: 'ai',
            content: this.content
        }];
    }

    msgType: MsgType = 'ai-normal';

    copy(): AiNormalMessage {
        return new AiNormalMessage(this.topic, this.content);
    }

    getTopic(): Topic {
        return this.topic;
    }
}

export default AiNormalMessage;
