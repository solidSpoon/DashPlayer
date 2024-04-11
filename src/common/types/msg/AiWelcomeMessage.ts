import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";
import AiSynonymousSentenceResp from "@/common/types/aiRes/AiSynonymousSentenceResp";
import {Topic} from "@/fronted/hooks/useChatPanel";
import AiPunctuationResp from "@/common/types/aiRes/AiPunctuationResp";


export interface WelcomeMessageProps {
    originalTopic: string;
    synonymousSentenceTask: number;
    punctuationTask: number | null;
    topic: Topic;
}

const MSG = `
好的, 我会为您分析这个句子: {originalTopic}

翻译: {translate}
`

class AiWelcomeMessage implements CustomMessage<AiWelcomeMessage> {
    public originalTopic: string;
    public synonymousSentenceTask: number;
    public punctuationTask: number | null = null;
    public topic: Topic;
    public synonymousSentenceTaskResp: AiSynonymousSentenceResp | null = null;
    public punctuationTaskResp: AiPunctuationResp | null = null;

    constructor(props: WelcomeMessageProps) {
        this.originalTopic = props.originalTopic;
        this.synonymousSentenceTask = props.synonymousSentenceTask;
        this.punctuationTask = props.punctuationTask;
        this.topic = props.topic;
    }

    public toMsg(): MsgT[] {
        return [];
    }


    public copy(): AiWelcomeMessage {
        const c = new AiWelcomeMessage({
            originalTopic: this.originalTopic,
            synonymousSentenceTask: this.synonymousSentenceTask,
            punctuationTask: this.punctuationTask,
            topic: this.topic
        });
        c.synonymousSentenceTaskResp = this.synonymousSentenceTaskResp;
        c.punctuationTaskResp = this.punctuationTaskResp;
        return c;
    }

    msgType: MsgType = "ai-welcome";
}

export default AiWelcomeMessage;
