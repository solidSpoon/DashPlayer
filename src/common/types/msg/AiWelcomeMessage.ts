import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { CoreMessage } from 'ai';

class AiWelcomeMessage implements CustomMessage<AiWelcomeMessage> {
    public readonly content: string;
    public readonly contextContent: string;
    private readonly topic: Topic;

    async toMsg(): Promise<CoreMessage[]> {
        return [{
            role: 'assistant',
            content: this.contextContent,
        }];
    }

    constructor(topic: Topic, content: string, contextContent?: string) {
        this.topic = topic;
        this.content = content;
        this.contextContent = contextContent ?? content;
    }


    public copy(): AiWelcomeMessage {
        return new AiWelcomeMessage(this.topic, this.content, this.contextContent);
    }

    msgType: MsgType = 'ai-welcome';

    getTopic(): Topic {
        return this.topic;
    }

    getTaskIds(): number[] {
        return [];
    }
}

export default AiWelcomeMessage;
