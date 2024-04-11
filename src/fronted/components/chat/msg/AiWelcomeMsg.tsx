import {IconOpenAI, IconUser} from "@/fronted/components/chat/icons";
import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import {cn} from "@/fronted/lib/utils";
import Playable from "@/fronted/components/chat/Playable";

const AiWelcomeMsg = ({msg}: { msg: AiWelcomeMessage }) => {
    const synonymousSentenceResp = msg.synonymousSentenceTaskResp;
    const punctuationTaskResp = msg.punctuationTaskResp;
    const length = synonymousSentenceResp?.sentences?.length ?? 0;
    console.log('punctuationTaskResp', punctuationTaskResp)
    return (
        <div className={cn('group relative flex items-start')}>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose">
                <h2>分析句子</h2>
                <p>我来帮你分析这个句子</p>
                <blockquote>
                    <p>{msg.originalTopic}</p>
                </blockquote>
                <p>已经为您生成了这个句子的知识点, 包括生词, 短语, 语法, 例句等</p>
                {length > 0 && <>
                    <h3>同义句</h3>
                    <p>这个句子还有如下几种表达方式:</p>
                    {synonymousSentenceResp.sentences.map((s, index) => (
                        <li key={index}>
                            <Playable>{s}</Playable>
                        </li>
                    ))}
                </>}
                {!msg.punctuationFinish && <>
                    <h3>分析句子完整性</h3>
                    <p>
                        正在分析句子完整性...
                    </p>
                </>}
                {!(punctuationTaskResp?.isComplete ?? true) && <>
                    <h3>建议更换会话内容</h3>
                    <p>这句话可能被换行打断了, 完整形式应该为下面这句, 您可以点击切换</p>
                    <blockquote>
                        <p>{punctuationTaskResp?.completeVersion}</p>
                    </blockquote>
                </>}
            </div>
        </div>
    );
}


export default AiWelcomeMsg;
