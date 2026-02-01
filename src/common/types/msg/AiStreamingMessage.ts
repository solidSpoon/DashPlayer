import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { ModelMessage } from 'ai';

class AiStreamingMessage implements CustomMessage<AiStreamingMessage> {
    private readonly topic: Topic;
    public readonly messageId: string;
    public readonly content: string;
    public readonly isStreaming: boolean;

    constructor(topic: Topic, messageId: string, content: string, isStreaming = true) {
        this.topic = topic;
        this.messageId = messageId;
        this.content = content;
        this.isStreaming = isStreaming;
    }

    async toMsg(): Promise<ModelMessage[]> {
        const content = this.content.replace(/\[\[switch:[\s\S]*?\]\]/g, '');
        return [{
            role: 'assistant',
            content,
        }];
    }

    msgType: MsgType = 'ai-streaming';

    copy(): AiStreamingMessage {
        return new AiStreamingMessage(this.topic, this.messageId, this.content, this.isStreaming);
    }

    withUpdate(content: string, isStreaming = this.isStreaming): AiStreamingMessage {
        return new AiStreamingMessage(this.topic, this.messageId, content, isStreaming);
    }

    getTopic(): Topic {
        return this.topic;
    }

    getTaskIds(): number[] {
        return [];
    }
}

export default AiStreamingMessage;
