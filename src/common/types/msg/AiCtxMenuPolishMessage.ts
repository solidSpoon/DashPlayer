import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import { codeBlock } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { AiFuncPolishRes } from '@/common/types/aiRes/AiFuncPolish';

export default class AiCtxMenuPolishMessage implements CustomMessage<AiCtxMenuPolishMessage> {
    public taskId: number;
    private readonly topic: Topic;
    public origin: string;
    public resp: AiFuncPolishRes | null = null;

    constructor(taskId: number, topic:Topic, origin: string) {
        this.taskId = taskId;
        this.origin = origin;
        this.topic = topic;
    }

    copy(): AiCtxMenuPolishMessage {
        const ctxMenuExplainSelectMessage = new AiCtxMenuPolishMessage(this.taskId,this.topic, this.origin);
        ctxMenuExplainSelectMessage.resp = this.resp;
        return ctxMenuExplainSelectMessage;
    }

    msgType: MsgType = 'ai-func-polish';

    toMsg(): MsgT[] {
        // 根据以上信息编造一个假的回复
        const aiResp = codeBlock`
        好的，这句话可以这样润色：

        - ${this.resp?.edit1}
        - ${this.resp?.edit2}
        - ${this.resp?.edit3}
        `
        return [{
            type:'human',
            content: `帮我用三种方式润色这句话，让它更地道`
        },{
            type:'ai',
            content: aiResp
        }];
    }

    getTopic(): Topic {
        return this.topic;
    }
}
