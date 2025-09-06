import { IconOpenAI } from '@/fronted/components/chat/icons';
import AiWelcomeMessage from '@/common/types/msg/AiWelcomeMessage';
import { cn } from '@/fronted/lib/utils';
import Playable from '@/fronted/components/chat/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiFuncPolishRes } from '@/common/types/aiRes/AiFuncPolish';
import { AiFuncPunctuationRes } from '@/common/types/aiRes/AiPunctuationResp';
import { AiFuncTranslateWithContextRes } from '@/common/types/aiRes/AiFuncTranslateWithContextRes';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const AiWelcomeMsg = ({ msg }: { msg: AiWelcomeMessage }) => {
    const logger = getRendererLogger('AiWelcomeMsg');
    const { detail: polishTaskRes } = useDpTaskViewer<AiFuncPolishRes>(msg.polishTask);
    const { detail: punctuationTaskResp } = useDpTaskViewer<AiFuncPunctuationRes>(msg.punctuationTask);
    const { detail: transTaskResp } = useDpTaskViewer<AiFuncTranslateWithContextRes>(msg.translateTask);
    const createTopic = useChatPanel(s => s.createFromSelect);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    const complete =
        !(punctuationTaskResp?.isComplete ?? true) && punctuationTaskResp?.completeVersion !== msg.originalTopic;

      return (
        <div className={cn('group relative flex items-start')}>
            {/* <Button variant={'ghost'} size={'icon'} onClick={()=>retry('welcome')} */}
            {/*         className={'absolute right-2 top-2 w-8 h-8 text-gray-400 dark:text-gray-200'}> */}
            {/*     <RefreshCcw className={'w-3 h-3'} /> */}
            {/* </Button> */}
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI />
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose dark:prose-invert">
                <h2>分析句子</h2>
                <p>我来帮你分析这个句子</p>
                <blockquote
                    onContextMenu={(e) => {
                        updateInternalContext(msg.originalTopic);
                    }}
                >
                    <p><Playable>{msg.originalTopic}</Playable></p>
                    {StrUtil.isNotBlank(transTaskResp?.translation) && <p>{transTaskResp?.translation}</p>}
                </blockquote>
                <p>已经为您生成了这个句子的知识点, 包括生词, 短语, 语法, 例句等</p>
                {complete && <>
                    <h3>建议更换会话内容</h3>
                    <p>这句话可能被换行打断了, 完整形式应该为下面这句, 您可以 <span
                        className={'underline cursor-pointer'}
                        onClick={() => createTopic(punctuationTaskResp?.completeVersion)}
                    >点击切换</span></p>
                    <blockquote
                        onContextMenu={(e) => {
                            updateInternalContext(punctuationTaskResp?.completeVersion ?? '');
                        }}
                    >
                        <p>{punctuationTaskResp?.completeVersion}</p>
                    </blockquote>
                </>}
                {StrUtil.hasNonBlank(polishTaskRes?.edit1, polishTaskRes?.edit2, polishTaskRes?.edit3) && (<>
                    <h3>同义句</h3>
                    <p>这个句子还有如下几种表达方式:</p>
                    <li
                        onContextMenu={(e) => {
                            updateInternalContext(polishTaskRes?.edit1 ?? '');
                        }}
                    ><Playable>{polishTaskRes?.edit1}</Playable></li>
                    <li
                        onContextMenu={(e) => {
                            updateInternalContext(polishTaskRes?.edit2 ?? '');
                        }}
                    ><Playable>{polishTaskRes?.edit2}</Playable></li>
                    <li
                        onContextMenu={(e) => {
                            updateInternalContext(polishTaskRes?.edit3 ?? '');
                        }}
                    ><Playable>{polishTaskRes?.edit3}</Playable></li>
                </>)}
            </div>
        </div>
    );
};


export default AiWelcomeMsg;
