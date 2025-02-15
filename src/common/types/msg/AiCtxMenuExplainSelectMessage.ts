import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { codeBlock } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { AiFuncExplainSelectRes } from '@/common/types/aiRes/AiFuncExplainSelectRes';
import { getDpTaskResult } from '@/fronted/hooks/useDpTaskCenter';
import { CoreMessage } from 'ai';

export default class AiCtxMenuExplainSelectMessage implements CustomMessage<AiCtxMenuExplainSelectMessage> {
    public taskId: number;
    public topic: Topic;
    public word: string;

    constructor(taskId: number, topic:Topic, selected: string) {
        this.taskId = taskId;
        this.word = selected;
        this.topic = topic;
    }

    copy(): AiCtxMenuExplainSelectMessage {
        return new AiCtxMenuExplainSelectMessage(this.taskId, this.topic, this.word);
    }

    msgType: MsgType = 'ai-func-explain-select';

    async toMsg(): Promise<CoreMessage[]> {

        const resp = await getDpTaskResult<AiFuncExplainSelectRes>(this.taskId);
        // 根据以上信息编造一个假的回复
        const aiResp = codeBlock`
        好的，我来解释一下这个单词/短语"${this.word}"。

        音标：${resp?.word.phonetic}
        中文释义：${resp?.word.meaningZh}
        英文释义：${resp?.word.meaningEn}

        - 例句1：${resp?.examplesSentence1}
        - 例句2：${resp?.examplesSentence2}
        - 例句3：${resp?.examplesSentence3}
        `
        return [{
            role:'user',
            content: `请帮我理解这个单词/短语 ${this.word}`
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
