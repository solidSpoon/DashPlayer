import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { codeBlock } from 'common-tags';
import { Topic } from '@/fronted/hooks/useChatPanel';
import { getDpTaskResult } from '@/fronted/hooks/useDpTaskCenter';
import { AiFuncExplainSelectWithContextRes } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';
import { CoreMessage } from 'ai';

export default class AiCtxMenuExplainSelectWithContextMessage implements CustomMessage<AiCtxMenuExplainSelectWithContextMessage> {
    public taskId: number;
    public topic: Topic;
    public context: string;
    public selected: string;

    constructor(taskId: number, topic: Topic, context: string, selected: string) {
        this.taskId = taskId;
        this.context = context;
        this.selected = selected;
        this.topic = topic;
    }

    copy(): AiCtxMenuExplainSelectWithContextMessage {
        return new AiCtxMenuExplainSelectWithContextMessage(this.taskId, this.topic, this.context, this.selected);
    }

    msgType: MsgType = 'ai-func-explain-select-with-context';

    async toMsg(): Promise<CoreMessage[]> {
        const resp = await getDpTaskResult<AiFuncExplainSelectWithContextRes>(this.taskId);
        // 根据以上信息编造一个假的回复
        const aiResp = codeBlock`
        好的，我来解释一下这句话中的"${this.selected}"。

        "${this.selected}"的意思是${resp?.word?.meaningZh ?? '' + resp?.word?.meaningEn ?? ''}。
        在这句话中，"${this.selected}"的意思是${resp?.word.meaningInSentence}。
        `;
        return [{
            role: 'user',
            content: `请帮我解释下面这句话中的"${this.selected}"\n"""\n${this.context}\n"""`
        }, {
            role: 'assistant',
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
