import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { getDpTaskResult } from '@/fronted/hooks/useDpTaskCenter';
import { CoreMessage } from 'ai';

class AiNormalMessage implements CustomMessage<AiNormalMessage> {
    private readonly topic: Topic;
    public readonly taskId: number;

    constructor(topic: Topic, taskId: number) {
        this.topic = topic;
        this.taskId = taskId;
    }

    async toMsg(): Promise<CoreMessage[]> {
        const msg = await getDpTaskResult<string>(this.taskId, true);
        return [{
            role: 'assistant',
            content: msg ?? ''
        }];
    }

    msgType: MsgType = 'ai-normal';

    copy(): AiNormalMessage {
        return new AiNormalMessage(this.topic, this.taskId);
    }

    getTopic(): Topic {
        return this.topic;
    }

    getTaskIds(): number[] {
        return [this.taskId];
    }
}

export default AiNormalMessage;
