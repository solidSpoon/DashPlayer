import { cn } from '@/fronted/lib/utils';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { useMemo } from 'react';
import { getRendererLogger } from '@/fronted/log/simple-logger';

export interface SwitchTopicProps {
    encoded: string;
    label?: string;
    className?: string;
}

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
        <button
            type="button"
            className={cn(
                'inline-flex items-center text-sm text-muted-foreground underline underline-offset-4 decoration-dashed hover:text-foreground',
                className
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
    );
};

SwitchTopic.defaultProps = {
    label: '点击切换',
    className: '',
};

export default SwitchTopic;
