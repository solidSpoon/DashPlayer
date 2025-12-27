import React from 'react';
import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import { AiPhraseGroupElement, AiPhraseGroupRes } from '@/common/types/aiRes/AiPhraseGroupRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import StrUtil from '@/common/utils/str-util';
import { Button } from '@/fronted/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import '@/fronted/styles/topic.css';
import useDpTaskViewer from "@/fronted/hooks/useDpTaskViewer";
import {Nullable} from "@/common/types/Types";
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('HumanTopicMsg');

const process = (original: string, parseRes: Nullable<AiPhraseGroupRes>): (string | AiPhraseGroupElement)[] => {
    if (((parseRes?.phraseGroups ?? []).length) === 0) return [original];
    if (StrUtil.isBlank(original)) return [];
    const res = [];
    let text = original;
    for (const group of parseRes?.phraseGroups??[]) {
        if (StrUtil.isBlank(group?.original)) continue;
        if (StrUtil.isBlank(text)) {
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
        logger.debug('phrase group processing', { before, after });
        if (before) res.push(before);
        res.push(group);
        text = after;
    }
    if (text) res.push(text.trim());

    return res;
};
const HumanTopicMsg = ({ msg }: { msg: HumanTopicMessage }) => {
    const retry = useChatPanel(state => state.retry);
    const {detail:res} = useDpTaskViewer<AiPhraseGroupRes>(msg.phraseGroupTask);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    // const res = JSON.parse(dpTask?.result ?? '{}') as AiPhraseGroupRes;
    const mapColor = (tags: string[]): string => {
        //判空
        if (!tags) return 'bg-secondary';
        const comment = tags.join(',');
        if (StrUtil.isBlank(comment)) return 'bg-secondary';
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
            <div className="flex flex-row flex-wrap pt-4 text-foreground">
                <div className="inline">
                    {content.map((group, i) => {
                        if (typeof group === 'string') {
                            return (

                                <span
                                    key={`text:${i}`}
                                    className={cn('px-2 py-1 rounded word')}>{group}</span>
                            );
                        } else {
                            const words = group.original.split(' ');
                            return (
                                <span
                                    key={`group:${i}:${group.original}`}
                                    className={
                                        cn('word-group relative rounded-md mr-1 p-1 pl-2 pr-1 leading-[42px] last:pr-2'
                                            , mapColor(group?.tags ?? [])
                                        )}>
                                    {words.map((word, wordIndex) => {
                                        return <span key={`${i}:${wordIndex}:${word}`} data-tags={group.tags} data-trans={group.translation}
                                                     className="word">
                                    {word}
                                    </span>;
                                    })}
                    </span>
                            );
                        }
                    })}
                </div>
            </div>
        </div>
    );
};

export default HumanTopicMsg;
