import CustomMessage, {MsgType} from "@/common/types/msg/interfaces/CustomMessage";
import {MsgT} from "@/common/types/msg/interfaces/MsgT";
import {Topic} from "@/fronted/hooks/useChatPanel";


export interface WelcomeMessageProps {
    originalTopic: string;
    synonymousSentenceTask: number;
    punctuationTask: number | null;
    translateTask: number;
    topic: Topic;
}

const MSG = `
好的, 我会为您分析这个句子: {originalTopic}

翻译: {translate}
`

class AiWelcomeMessage implements CustomMessage<AiWelcomeMessage> {
    public originalTopic: string;
    public polishTask: number;
    public punctuationTask: number | null = null;
    public translateTask: number;
    public topic: Topic;

    constructor(props: WelcomeMessageProps) {
        this.originalTopic = props.originalTopic;
        this.polishTask = props.synonymousSentenceTask;
        this.punctuationTask = props.punctuationTask;
        this.translateTask = props.translateTask;
        this.topic = props.topic;
    }

    async toMsg(): Promise<MsgT[]> {
        return [];
    }


    public copy(): AiWelcomeMessage {
        const c = new AiWelcomeMessage({
            originalTopic: this.originalTopic,
            synonymousSentenceTask: this.polishTask,
            punctuationTask: this.punctuationTask,
            topic: this.topic,
            translateTask: this.translateTask,
        });
        return c;
    }

    msgType: MsgType = "ai-welcome";

    getTopic(): Topic {
        return this.topic;
    }
}

export default AiWelcomeMessage;
