import {IconOpenAI, IconUser} from "@/fronted/components/chat/icons";
import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import {cn} from "@/fronted/lib/utils";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const AiWelcomeMsg = ({msg}: { msg: AiWelcomeMessage }) => {
    const synonymousSentenceResp = msg.synonymousSentenceTaskResp;
    const punctuationTaskResp = msg.punctuationTaskResp;
    const length = synonymousSentenceResp?.sentences?.length ?? 0;
    const createTopic = useChatPanel(s=>s.createTopic);
    console.log('punctuationTaskResp', punctuationTaskResp)
    const complete =
        !(punctuationTaskResp?.isComplete ?? true) && punctuationTaskResp?.completeVersion !== msg.originalTopic;
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
                {complete && <>
                    <h3>建议更换会话内容</h3>
                    <p>这句话可能被换行打断了, 完整形式应该为下面这句, 您可以 <span
                        className={'underline cursor-pointer'}
                        onClick={() => createTopic({content: punctuationTaskResp?.completeVersion})}
                    >点击切换</span></p>
                    <blockquote>
                        <p>{punctuationTaskResp?.completeVersion}</p>
                    </blockquote>
                </>}
                {length > 0 && <>
                    <h3>同义句</h3>
                    <p>这个句子还有如下几种表达方式:</p>
                    {synonymousSentenceResp.sentences.map((s, index) => (
                        <li key={index}>
                            <Playable>{s}</Playable>
                        </li>
                    ))}
                </>}
            </div>
        </div>
    );
}


export default AiWelcomeMsg;
