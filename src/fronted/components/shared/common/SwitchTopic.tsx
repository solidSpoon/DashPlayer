import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { useMemo } from 'react';
import { getRendererLogger } from '@/fronted/log/simple-logger';

/**
 * `switch:` 自定义链接的渲染参数。
 */
export interface SwitchTopicProps {
    /** 编码后的完整版原文。 */
    encoded: string;
    /** 切换按钮展示文案。 */
    label?: string;
    /** 额外挂载到根节点的样式类。 */
    className?: string;
}

/**
 * 渲染“完整版原文 + 切换按钮”组合，便于用户先看到完整句子，再决定是否切换学习主题。
 */
const SwitchTopic = ({ encoded, label, className }: SwitchTopicProps) => {
    const logger = getRendererLogger('SwitchTopic');
    const createFromSelect = useChatPanel(s => s.createFromSelect);
    const decoded = useMemo(() => {
        try {
            return decodeURIComponent(encoded);
        } catch {
            return encoded;
        }
    }, [encoded]);
    const text = label && label.trim().length > 0 ? label : '点击切换';
    return (
        <span
            className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}
        >
            <span className="text-foreground">{decoded}</span>
            <button
                type="button"
                className={cn(
                    'inline-flex items-center text-sm text-muted-foreground underline underline-offset-4 decoration-dashed hover:text-foreground',
                )}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!decoded) {
                        return;
                    }
                    createFromSelect(decoded).catch((error) => {
                        logger.error('failed to switch topic', { error });
                    });
                }}
            >
                {text}
            </button>
        </span>
    );
};

SwitchTopic.defaultProps = {
    label: '点击切换',
    className: '',
};

export default SwitchTopic;
