import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import { Topic } from '@/fronted/hooks/useChatPanel';

class AiNormalMessage implements CustomMessage<AiNormalMessage> {
    private readonly topic: Topic;
    public readonly taskId: number;

    constructor(topic: Topic, taskId: number) {
        this.topic = topic;
        this.taskId = taskId;
    }

    async toMsg(): Promise<MsgT[]> {
        return [{
            type: 'ai',
            content: '这是一个普通的AI消息'
        }];
    }

    msgType: MsgType = 'ai-normal';

    copy(): AiNormalMessage {
        return new AiNormalMessage(this.topic, this.taskId);
    }

    getTopic(): Topic {
        return this.topic;
    }
}

export default AiNormalMessage;
