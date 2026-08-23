import React from 'react';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/features/chat/chatStore';
import StrUtil from '@/common/utils/str-util';

/**
 * 意群组数据项类型（兼容字符串或历史对象结构）。
 */
type PhraseGroupItem = string | { original?: string };

/**
 * 按分析结果把原句拆成普通文本与意群片段。
 * @param original 原始主题句。
 * @param phraseGroups AI 返回的短语分组。
 * @returns 保持原句顺序的文本和短语片段。
 */
const process = (
    original: string,
    phraseGroups?: AiUnifiedAnalysisRes['structure']['phraseGroups'] | PhraseGroupItem[]
): { text: string; isGroup: boolean }[] => {
    if (!phraseGroups || phraseGroups.length === 0) {
        return [{ text: original, isGroup: false }];
    }
    if (StrUtil.isBlank(original)) return [];
    const res: { text: string; isGroup: boolean }[] = [];
    let remaining = original;

    for (const group of phraseGroups) {
        const rawGroupText = typeof group === 'string' ? group : group?.original;
        if (!rawGroupText || StrUtil.isBlank(rawGroupText)) continue;
        if (StrUtil.isBlank(remaining)) continue;

        const analyse = rawGroupText.trim();
        const lowerCaseText = remaining.toLowerCase();
        const lowerCaseOriginal = analyse.toLowerCase();
        const index = lowerCaseText.indexOf(lowerCaseOriginal);
        if (index < 0) continue;

        const before = remaining.substring(0, index);
        const matched = remaining.substring(index, index + analyse.length);
        const after = remaining.substring(index + analyse.length);

        if (before) {
            res.push({ text: before, isGroup: false });
        }
        res.push({ text: matched, isGroup: true });
        remaining = after;
    }
    if (remaining) {
        res.push({ text: remaining, isGroup: false });
    }

    return res;
};

/** 首条主题消息的业务内容参数。 */
type UserTopicMessageProps = {
    /** 需要展示句法分组的原始主题句。 */
    content: string;
};

/**
 * 展示首条主题句的意群分组和翻译信息。
 * @param props 主题句内容。
 * @returns 主题句业务可视化内容。
 */
const UserTopicMessage = ({ content: messageContent }: UserTopicMessageProps) => {
    const analysis = useChatPanel(state => state.analysis);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);

    const groupColors = [
        'bg-red-100 dark:bg-red-900/30',
        'bg-green-100 dark:bg-green-900/30',
        'bg-blue-100 dark:bg-blue-900/30',
        'bg-yellow-100 dark:bg-yellow-900/30',
        'bg-sky-100 dark:bg-sky-900/30',
        'bg-indigo-100 dark:bg-indigo-900/30',
        'bg-amber-100 dark:bg-amber-900/30',
        'bg-cyan-100 dark:bg-cyan-900/30',
    ];

    const content = process(messageContent, analysis?.structure?.phraseGroups);
    return (
        <div
            onContextMenu={() => {
                updateInternalContext(messageContent);
            }}
            className="relative px-1 py-1 text-base leading-relaxed"
        >
            {content.map((item, i) => {
                if (!item.isGroup) {
                    // 普通文本包含标点和连接词，需要保持原句中的相对位置。
                    const isPunctuation = /^[.,!?;:]+$/.test(item.text.trim());
                    return (
                        <span key={`text:${i}`} className={cn('font-medium text-foreground/80', isPunctuation && '-ml-1')}>
                            {item.text}
                        </span>
                    );
                } else {
                    const groupIndex = content.slice(0, i + 1).filter((entry) => entry.isGroup).length - 1;
                    const colorClass = groupColors[groupIndex % groupColors.length];
                    return (
                        <span
                            key={`group:${i}:${item.text}`}
                            className={cn(
                                'box-decoration-clone rounded-md py-0.5 font-medium',
                                colorClass
                            )}
                        >
                            {item.text}
                        </span>
                    );
                }
            })}
        </div>
    );
};

export default UserTopicMessage;
