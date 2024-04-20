import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import { AiFuncExplainSelectRes } from '@/common/types/aiRes/AiFuncExplainSelectRes';
import { oneLineTrim } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';

export default class AiCtxMenuExplainSelectMessage implements CustomMessage<AiCtxMenuExplainSelectMessage> {
    public taskId: number;
    public topic: Topic;
    public context: string;
    public selected: string;
    public resp: AiFuncExplainSelectRes | null = null;

    constructor(taskId: number, topic:Topic, context: string, selected: string) {
        this.taskId = taskId;
        this.context = context;
        this.selected = selected;
        this.topic = topic;
    }

    copy(): AiCtxMenuExplainSelectMessage {
        const ctxMenuExplainSelectMessage = new AiCtxMenuExplainSelectMessage(this.taskId,this.topic, this.context, this.selected);
        ctxMenuExplainSelectMessage.resp = this.resp;
        ctxMenuExplainSelectMessage.topic = this.topic;
        return ctxMenuExplainSelectMessage;
    }

    msgType: MsgType = 'ai-func-explain-select';

    toMsg(): MsgT[] {
        //export interface AiFuncExplainSelectRes {
        //     sentence: {
        //         sentence: string;
        //         meaning: string;
        //     };
        //     word: {
        //         word: string;
        //         phonetic: string;
        //         meaning: string;
        //         meaningInSentence: string;
        //     };
        //     idiom?: {
        //         idiom: string;
        //         meaning: string;
        //     };
        // }

        // 根据以上信息编造一个假的回复
        const aiResp = oneLineTrim`
        好的，我来解释一下这句话中的"${this.selected}"。

        "${this.selected}"的意思是${this.resp?.word.meaning}。
        在这句话中，"${this.selected}"的意思是${this.resp?.word.meaningInSentence}。

        ${this.resp.idiom ? `另外，"${this.selected}"也是一个俗语，意思是${this.resp.idiom.meaning}。` : ''}
        `
        return [{
            type:'human',
            content: `请帮我解释下面这句话中的"${this.selected}"\n"""\n${this.context}\n"""`
        },{
            type:'ai',
            content: aiResp
        }];
    }
}
