import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { cn } from '@/fronted/lib/utils';
import { Card, CardContent } from '@/fronted/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import useChatPanel from '@/fronted/hooks/useChatPanel';

const TopicSelector = ({ className }: {
    className: string,
}) => {

    const currentSentence = usePlayerV2(state => state.currentSentence);
    const sentences = usePlayerV2(state => state.sentences);
    const subtitles = (() => {
        if (!currentSentence) return [] as typeof sentences;
        const idx = sentences.findIndex(s => s.index === currentSentence.index && s.fileHash === currentSentence.fileHash);
        const left = Math.max(0, idx - 5);
        const right = Math.min(sentences.length - 1, idx + 5);
        return sentences.slice(left, right + 1);
    })();

    const [mouseOver, setMouseOver] = useState(false);

    const currentRef = useRef<HTMLSpanElement>(null);

    const updateInternalContext = useChatPanel(s => s.updateInternalContext);

    useEffect(() => {
        if (!currentRef.current) {
            return;
        }
        // if (!mouseOver) {
        currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // }
    }, [mouseOver]);

    return (
        <Card
            className={'shadow-none'}
            onMouseEnter={() => setMouseOver(true)}
            onMouseLeave={() => setMouseOver(false)}
        >
            <CardContent className={cn(' text-sm px-4 py-2 overflow-y-auto scrollbar-none')}>
                {/*<div*/}
                {/*    className="text-sm mt-2 text-foreground/80 sticky top-0 bg-gradient-to-b from-transparent to-transparent  h-6"/>*/}
                {
                    subtitles.map((s, i) => (
                        <div
                            onContextMenu={(e) => {
                                updateInternalContext(s.text);
                            }}
                            // ref={s === currentSentence ? currentRef : null}
                            key={i} className={cn(s === currentSentence ? 'item-current' : 'item-normal')}>
                            {s.text}
                        </div>
                    ))
                }
                {/*<div*/}
                {/*    className="text-sm mb-2 text-foreground/80 sticky bottom-0 bg-gradient-to-t from-background to-transparent  h-6"/>*/}
            </CardContent>
        </Card>
    );
};

export default TopicSelector;
