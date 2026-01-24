import React from 'react';
import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('UserTopicMessage');

const process = (
    original: string,
    phraseGroups?: AiUnifiedAnalysisRes['structure']['phraseGroups']
): (string | AiUnifiedAnalysisRes['structure']['phraseGroups'][0])[] => {
    if (!phraseGroups || phraseGroups.length === 0) return [original];
    if (StrUtil.isBlank(original)) return [];
    const res = [];
    let text = original;
    for (const group of phraseGroups) {
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
const UserTopicMessage = ({ msg }: { msg: HumanTopicMessage }) => {
    const analysis = useChatPanel(state => state.analysis);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);

    const mapColor = (tags: string[]): string => {
        if (!tags || tags.length === 0) return 'bg-secondary/50';
        const comment = tags.join(',');
        if (StrUtil.isBlank(comment)) return 'bg-secondary/50';
        
        if (comment.includes('主语')) return 'bg-red-100 dark:bg-red-900/30';
        if (comment.includes('谓语')) return 'bg-green-100 dark:bg-green-900/30';
        if (comment.includes('宾语')) return 'bg-blue-100 dark:bg-blue-900/30';
        if (comment.includes('表语')) return 'bg-yellow-100 dark:bg-yellow-900/30';

        return 'bg-secondary/50';
    };

    const content = process(msg.content, analysis?.structure?.phraseGroups);
    
    return (
        <div
            onContextMenu={(e) => {
                updateInternalContext(msg.content);
            }}
            className="flex flex-wrap items-start gap-x-2 gap-y-6 px-4 py-1 relative"
        >
            {content.map((group, i) => {
                if (typeof group === 'string') {
                    // Plain text (punctuation, connectors)
                    const isPunctuation = /^[.,!?;:]+$/.test(group.trim());
                    return (
                        <div key={`text:${i}`} className={cn(
                            "flex flex-col justify-center self-stretch pt-4",
                            isPunctuation && "-ml-2" // Pull punctuation closer to the previous bubble
                        )}>
                             <span className="text-xl font-medium text-foreground/80">{group}</span>
                        </div>
                    );
                } else {
                    // Phrase Group
                    const tags = group.tags ?? [];
                    return (
                        <div key={`group:${i}:${group.original}`} className="flex flex-col group cursor-default">
                            {/* Top: Tags */}
                            <div className="flex items-end px-1 -mb-3 relative z-10">
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tight leading-none whitespace-nowrap bg-background/95 px-1 rounded-sm backdrop-blur-md shadow-sm">
                                    {tags.join(', ')}
                                </span>
                            </div>
                            
                            {/* Middle: Text Bubble */}
                            <div 
                                className={cn(
                                    "px-2 py-1 pt-2.5 pb-1.5 rounded-md text-lg font-medium transition-colors relative z-0",
                                    "border border-transparent hover:border-border/50", 
                                    mapColor(tags)
                                )}
                            >
                                <span className="text-foreground">
                                    {group.original}
                                </span>
                            </div>

                            {/* Bottom: Translation */}
                            <div className="flex items-start px-1 -mt-2.5 relative z-10">
                                <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/90 font-normal leading-tight whitespace-nowrap bg-background/95 px-1 rounded-sm backdrop-blur-md shadow-sm">
                                    {group.translation}
                                </span>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    );
};

export default UserTopicMessage;
