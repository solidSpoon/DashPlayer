import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import useDpTask from '@/fronted/hooks/useDpTask';
import { AiPhraseGroupRes } from '@/common/types/aiRes/AiPhraseGroupRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { strBlank } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import { RefreshCcw } from 'lucide-react';

const HumanTopicMsg = ({ msg }: { msg: HumanTopicMessage }) => {
    const retry = useChatPanel(state => state.retry);
    const dpTask = useDpTask(msg.phraseGroupTask, 200);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    const res = JSON.parse(dpTask?.result ?? '{}') as AiPhraseGroupRes;
    const mapColor = (comment: string): string => {
        if (strBlank(comment)) return 'bg-secondary';
        // 为包含 主语、谓语、宾语、表语 的词组添加颜色
        if (comment.includes('主语')) {
            return 'bg-red-100';
        }
        if (comment.includes('谓语')) {
            return 'bg-green-100';
        }
        if (comment.includes('宾语')) {
            return 'bg-blue-100';
        }
        if (comment.includes('表语')) {
            return 'bg-yellow-100';
        }

        return 'bg-secondary';
    };

    return (
        <div
            onContextMenu={(e) => {
                updateInternalContext(msg.content);
            }}
            className={cn('text-lg flex flex-wrap gap-2 mb-4 pl-12 relative')}>
            <Button variant={'ghost'} size={'icon'} onClick={()=>retry('topic')}
                    className={'absolute right-2 top-2 w-8 h-8 text-gray-400 dark:text-gray-200'}>
                <RefreshCcw className={'w-3 h-3'} />
            </Button>
            {res?.phraseGroups?.map((group, i) => {
                return (
                    <div key={i}>
                        <div className={cn('text-xs translate-x-2')}>{group?.comment??' '}</div>
                        <span className={cn('px-2 py-1 rounded', mapColor(group?.comment))}>{group?.original??' '}</span>
                        <div className={cn('text-sm translate-x-2')}>{group?.translation??' '}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default HumanTopicMsg;
