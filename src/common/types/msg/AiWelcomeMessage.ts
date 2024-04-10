import {AIMessage, BaseMessage} from "@langchain/core/messages";
import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";
import AiSynonymousSentenceResp from "@/common/types/aiRes/AiSynonymousSentenceResp";


export interface WelcomeMessageProps {
    originalTopic: string;
    synonymousSentenceTask: number;
}

const MSG = `
好的, 我会为您分析这个句子: {originalTopic}

翻译: {translate}
`

class AiWelcomeMessage implements CustomMessage<AiWelcomeMessage> {
    public originalTopic: string;
    public synonymousSentenceTask: number;
    public synonymousSentenceTaskResp: AiSynonymousSentenceResp | null = null;

    constructor(props: WelcomeMessageProps) {
        this.originalTopic = props.originalTopic;
        this.synonymousSentenceTask = props.synonymousSentenceTask;
    }

    public toMsg(): MsgT[] {
        return [];
    }


    public copy(): AiWelcomeMessage {
        let c = new AiWelcomeMessage({
            originalTopic: this.originalTopic,
            synonymousSentenceTask: this.synonymousSentenceTask
        });
        c.synonymousSentenceTaskResp = this.synonymousSentenceTaskResp;
        return c;
    }

    msgType: MsgType = "ai-welcome";
}

export default AiWelcomeMessage;
