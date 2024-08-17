import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import { codeBlock } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { AiFuncExplainSelectWithContextRes } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';
import { AiFuncExplainSelectRes } from '@/common/types/aiRes/AiFuncExplainSelectRes';

export default class AiCtxMenuExplainSelectMessage implements CustomMessage<AiCtxMenuExplainSelectMessage> {
    public taskId: number;
    public topic: Topic;
    public word: string;
    public resp: AiFuncExplainSelectRes | null = null;

    constructor(taskId: number, topic:Topic, selected: string) {
        this.taskId = taskId;
        this.word = selected;
        this.topic = topic;
    }

    copy(): AiCtxMenuExplainSelectMessage {
        const ctxMenuExplainSelectMessage = new AiCtxMenuExplainSelectMessage(this.taskId,this.topic, this.word);
        ctxMenuExplainSelectMessage.resp = this.resp;
        return ctxMenuExplainSelectMessage;
    }

    msgType: MsgType = 'ai-func-explain-select';

    async toMsg(): Promise<MsgT[]> {
        // 根据以上信息编造一个假的回复
        const aiResp = codeBlock`
        好的，我来解释一下这个单词/短语"${this.word}"。

        音标：${this.resp?.word.phonetic}
        中文释义：${this.resp?.word.meaningZh}
        英文释义：${this.resp?.word.meaningEn}

        - 例句1：${this.resp?.examplesSentence1}
        - 例句2：${this.resp?.examplesSentence2}
        - 例句3：${this.resp?.examplesSentence3}
        `
        return [{
            type:'human',
            content: `请帮我理解这个单词/短语 ${this.word}`
        },{
            type:'ai',
            content: aiResp
        }];
    }

    getTopic(): Topic {
        return this.topic;
    }
}
