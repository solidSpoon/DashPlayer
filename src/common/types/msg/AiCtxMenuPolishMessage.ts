import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { codeBlock } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { AiFuncPolishRes } from '@/common/types/aiRes/AiFuncPolish';
import { getDpTaskResult } from '@/fronted/hooks/useDpTaskCenter';
import { CoreMessage } from 'ai';

export default class AiCtxMenuPolishMessage implements CustomMessage<AiCtxMenuPolishMessage> {
    public taskId: number;
    private readonly topic: Topic;
    public origin: string;

    constructor(taskId: number, topic:Topic, origin: string) {
        this.taskId = taskId;
        this.origin = origin;
        this.topic = topic;
    }

    copy(): AiCtxMenuPolishMessage {
        return new AiCtxMenuPolishMessage(this.taskId, this.topic, this.origin);
    }

    msgType: MsgType = 'ai-func-polish';

    async toMsg(): Promise<CoreMessage[]> {
        const resp: AiFuncPolishRes | null= await getDpTaskResult<AiFuncPolishRes>(this.taskId);
        // 根据以上信息编造一个假的回复
        const aiResp = codeBlock`
        好的，这句话可以这样润色：

        - ${resp?.edit1}
        - ${resp?.edit2}
        - ${resp?.edit3}
        `
        return [{
            role:'user',
            content: `帮我用三种方式润色这句话，让它更地道`
        },{
            role:'assistant',
            content: aiResp
        }];
    }

    getTopic(): Topic {
        return this.topic;
    }

    getTaskIds(): number[] {
        return [this.taskId];
    }
}
