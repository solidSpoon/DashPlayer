import React from 'react';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/features/chat/chatStore';
import StrUtil from '@/common/utils/str-util';

/**
 * 按分析结果把原句拆成普通文本与带标注的短语片段。
 * @param original 原始主题句。
 * @param phraseGroups AI 返回的短语分组。
 * @returns 保持原句顺序的文本和短语片段。
 */
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
        const analyse = group.original.trim();
        const lowerCaseText = text.toLowerCase();
        const lowerCaseOriginal = analyse.toLowerCase();
        const index = lowerCaseText.indexOf(lowerCaseOriginal);
        if (index < 0) continue;
        const before = text.substring(0, index);
        const after = text.substring(index + analyse.length);
        if (before) res.push(before);
        res.push(group);
        text = after;
    }
    if (text) res.push(text);

    return res;
};

/** 首条主题消息的业务内容参数。 */
type UserTopicMessageProps = {
    /** 需要展示句法分组的原始主题句。 */
    content: string;
};

/**
 * 展示首条主题句的句法分组、标签和翻译信息。
 * @param props 主题句内容。
 * @returns 主题句业务可视化内容。
 */
const UserTopicMessage = ({ content: messageContent }: UserTopicMessageProps) => {
    const analysis = useChatPanel(state => state.analysis);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);

    /**
     * 根据中文句法标签选择分组底色。
     * @param tags 当前短语的句法标签。
     * @returns 对应的 Tailwind 背景色类名。
     */
    const mapColor = (tags: string[]): string => {
        if (!tags || tags.length === 0) return 'bg-secondary/50';
        const comment = tags.join(',');
        if (StrUtil.isBlank(comment)) return 'bg-secondary/50';

        if (comment.includes('主语')) return 'bg-red-100 dark:bg-red-900/30';
        if (comment.includes('谓语')) return 'bg-green-100 dark:bg-green-900/30';
        if (comment.includes('宾语')) return 'bg-blue-100 dark:bg-blue-900/30';
        if (comment.includes('表语')) return 'bg-yellow-100 dark:bg-yellow-900/30';
        if (comment.includes('主句')) return 'bg-sky-100 dark:bg-sky-900/30';
        if (comment.includes('从句')) return 'bg-indigo-100 dark:bg-indigo-900/30';
        if (comment.includes('介词短语')) return 'bg-amber-100 dark:bg-amber-900/30';
        if (comment.includes('状语')) return 'bg-cyan-100 dark:bg-cyan-900/30';

        return 'bg-secondary/50';
    };

    const content = process(messageContent, analysis?.structure?.phraseGroups);
    
    return (
        <div
            onContextMenu={() => {
                updateInternalContext(messageContent);
            }}
            className="relative px-1 py-1 text-base leading-relaxed"
        >
            {content.map((group, i) => {
                if (typeof group === 'string') {
                    // 普通文本包含标点和连接词，需要保持原句中的相对位置。
                    const isPunctuation = /^[.,!?;:]+$/.test(group.trim());
                    return (
                        <span key={`text:${i}`} className={cn('font-medium text-foreground/80', isPunctuation && '-ml-1')}>
                            {group}
                        </span>
                    );
                } else {
                    // 短语分组只保留背景色，文本仍参与普通行内排版。
                    const tags = group.tags ?? [];
                    return (
                        <span
                            key={`group:${i}:${group.original}`}
                            className={cn(
                                'box-decoration-clone rounded-md py-0.5 font-medium',
                                mapColor(tags)
                            )}
                        >
                            {group.original}
                        </span>
                    );
                }
            })}
        </div>
    );
};

export default UserTopicMessage;
