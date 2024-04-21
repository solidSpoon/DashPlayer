import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import useDpTask from '@/fronted/hooks/useDpTask';
import { AiPhraseGroupRes } from '@/common/types/aiRes/AiPhraseGroupRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { strBlank } from '@/common/utils/Util';
import { Button } from '@/fronted/components/ui/button';
import { RefreshCcw } from 'lucide-react';

const process = (original: string, parseRes: AiPhraseGroupRes): (string | {
    original: string;
    translation: string;
    comment: string;
})[] => {
    if ((parseRes?.phraseGroups ?? [].length) === 0) return [original];
    if (strBlank(original)) return [];
    const res = [];
    let text = original;
    for (const group of parseRes.phraseGroups) {
        if (strBlank(group?.original)) continue;
        if (strBlank(text)) {
            // res.push(group);
            continue;
        }
        text = text.trim();
        const analyse = group.original.trim();
        const lowerCaseText = text.toLowerCase();
        const lowerCaseOriginal = analyse.toLowerCase();
        const index = lowerCaseText.indexOf(lowerCaseOriginal);
        const before = text.substring(0, index);
        const after = text.substring(index + group.original.length);
        console.log('before', before, 'after', after);
        if (before) res.push(before);
        res.push(group);
        text = after;
    }
    if (text) res.push(text.trim());

    return res;
};
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


    console.log('HumanTopicMsg', res);
    const content = process(msg.content, res);
    return (
        <div
            onContextMenu={(e) => {
                updateInternalContext(msg.content);
            }}
            className={cn('text-lg flex flex-wrap gap-2 mb-4 pl-12 pr-8 relative')}>
            <Button variant={'ghost'} size={'icon'} onClick={() => retry('topic')}
                    className={'absolute right-2 top-2 w-8 h-8 text-gray-400 dark:text-gray-200'}>
                <RefreshCcw className={'w-3 h-3'} />
            </Button>
            {content.map((group, i) => {
                if (typeof group === 'string') {
                    return (
                        <div key={i}>
                            <div className={cn('h-4')} />
                            <span
                                className={cn('px-2 py-1 rounded')}>{group}</span>
                        </div>
                    );
                } else {
                    return (
                        <div key={i}>
                            <div className={cn('text-xs translate-x-2 h-4')}>{group?.comment ?? ' '}</div>
                            <span
                                className={cn('px-2 py-1 rounded', mapColor(group?.comment))}>{group?.original ?? ' '}</span>
                            <div className={cn('text-sm translate-x-2')}>{group?.translation ?? ' '}</div>
                        </div>
                    );
                }
            })}
        </div>
    );
};

export default HumanTopicMsg;
