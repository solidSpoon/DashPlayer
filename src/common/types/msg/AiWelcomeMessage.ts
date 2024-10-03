import CustomMessage, { MsgType } from '@/common/types/msg/interfaces/CustomMessage';
import { MsgT } from '@/common/types/msg/interfaces/MsgT';
import useChatPanel, { Topic } from '@/fronted/hooks/useChatPanel';
import { getDpTaskResult } from '@/fronted/hooks/useDpTaskCenter';
import { AiAnalyseNewWordsRes } from '@/common/types/aiRes/AiAnalyseNewWordsRes';
import { AiAnalyseNewPhrasesRes } from '@/common/types/aiRes/AiAnalyseNewPhrasesRes';
import { AiFuncPolishRes } from '@/common/types/aiRes/AiFuncPolish';
import { AiFuncTranslateWithContextRes } from '@/common/types/aiRes/AiFuncTranslateWithContextRes';
import StrUtil from '@/common/utils/str-util';


export interface WelcomeMessageProps {
    originalTopic: string;
    synonymousSentenceTask: number;
    punctuationTask: number | null;
    translateTask: number;
    topic: Topic;
}

const MSG = `
## 句子分析报告

**原始句子:**
{originalTopic}

---

### 生词
在这个句子中，我们发现了一些可能对您来说是新的词汇：

{newWords}

### 词组
以下是句子中的一些重要词组，理解这些词组有助于更好地理解句子的整体意思：

{phraseGroup}

### 同义句
为了帮助您更加灵活和多样化地表达相同的意思，我们提供了以下几个同义句：

{polish}


---

*希望这些分析能够帮助您更深入地理解和运用这句话。如有疑问，请随时提问。*
`;

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
        const tasks = useChatPanel.getState().tasks;
        // 翻译
        const translate:string = await getDpTaskResult<AiFuncTranslateWithContextRes>(this.translateTask).then(res => res?.translation ?? '');
        // 生词
        const newWords:string[] = await getDpTaskResult<AiAnalyseNewWordsRes>(tasks.vocabularyTask).then(res => (res?.words ?? []).map(w => `- ${w.word}(${w.meaning})`));
        // 词组
        const phraseGroup:string[] = await getDpTaskResult<AiAnalyseNewPhrasesRes>(tasks.phraseTask).then(res => (res?.phrases ?? []).map(p => `- ${p.phrase}(${p.meaning})`));
        // 同义句
        const polish = await getDpTaskResult<AiFuncPolishRes>(this.polishTask).then(res => [res?.edit1, res?.edit2, res?.edit3].filter(s=>StrUtil.isNotBlank(s)).map(s => `- ${s}`));
        return [{
            type: "ai",
            content: MSG
                .replace("{originalTopic}", this.originalTopic)
                .replace("{translate}", translate)
                .replace("{newWords}", newWords.join('\n'))
                .replace("{phraseGroup}", phraseGroup.join('\n'))
                .replace("{polish}", polish.join('\n'))
        }]
    }


    public copy(): AiWelcomeMessage {
        const c = new AiWelcomeMessage({
            originalTopic: this.originalTopic,
            synonymousSentenceTask: this.polishTask,
            punctuationTask: this.punctuationTask,
            topic: this.topic,
            translateTask: this.translateTask
        });
        return c;
    }

    msgType: MsgType = 'ai-welcome';

    getTopic(): Topic {
        return this.topic;
    }

    getTaskIds(): number[] {
        return [this.polishTask, this.translateTask, this.punctuationTask]
            .filter(t => t !== null) as number[];
    }
}

export default AiWelcomeMessage;
