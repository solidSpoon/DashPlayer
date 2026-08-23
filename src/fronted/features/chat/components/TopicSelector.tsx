import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { LocateFixed, Search } from 'lucide-react';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useChatPanel from '@/fronted/features/chat/chatStore';
import type { SubtitleAgentView } from '@/fronted/features/chat/useSentenceLearningChat';
import { Badge } from '@/fronted/components/ui/badge';
import { Card } from '@/fronted/components/ui/card';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';

type TopicSelectorProps = {
    /** 从 AI SDK 消息片段派生的字幕查找和定位状态。 */
    agentView: SubtitleAgentView;
};

/**
 * 在整句学习面板中展示完整字幕，并响应 Agent 的查找与定位动作。
 * @param agentView AI 当前的搜索词、命中项和定位目标。
 * @returns 独立于播放器字幕列表的学习面板字幕查看器。
 */
const TopicSelector = ({ agentView }: TopicSelectorProps) => {
    const sentences = usePlayer((state) => state.sentences);
    const currentSentence = usePlayer((state) => state.currentSentence);
    const updateInternalContext = useChatPanel((state) => state.updateInternalContext);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const initialScrollDoneRef = useRef(false);
    const agentOriginRowIndexRef = useRef<number | null>(null);
    const agentWasRunningRef = useRef(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
    const [awayFromCurrent, setAwayFromCurrent] = useState(false);

    const matchedIndexes = useMemo(
        () => new Set(agentView.searchMatches),
        [agentView.searchMatches],
    );

    const currentRowIndex = useMemo(
        () => sentences.findIndex((sentence) => (
            sentence.index === currentSentence?.index && sentence.fileHash === currentSentence?.fileHash
        )),
        [currentSentence?.fileHash, currentSentence?.index, sentences],
    );

    useEffect(() => {
        if (initialScrollDoneRef.current || currentRowIndex < 0) {
            return;
        }
        virtuosoRef.current?.scrollToIndex({
            index: currentRowIndex,
            align: 'center',
            behavior: 'auto',
        });
        initialScrollDoneRef.current = true;
    }, [currentRowIndex]);

    useEffect(() => {
        if (agentView.focusIndex === null) {
            return;
        }
        const rowIndex = sentences.findIndex((sentence) => sentence.index === agentView.focusIndex);
        if (rowIndex < 0) {
            return;
        }
        virtuosoRef.current?.scrollToIndex({
            index: rowIndex,
            align: 'center',
            behavior: 'smooth',
        });
        const highlightTimer = window.setTimeout(() => setHighlightedIndex(agentView.focusIndex), 0);
        const timer = window.setTimeout(() => setHighlightedIndex(null), 2400);
        return () => {
            window.clearTimeout(highlightTimer);
            window.clearTimeout(timer);
        };
    }, [agentView.focusIndex, sentences]);

    useEffect(() => {
        if (agentView.running && !agentWasRunningRef.current) {
            agentOriginRowIndexRef.current = currentRowIndex >= 0 ? currentRowIndex : null;
        }
        if (!agentView.running && agentWasRunningRef.current && agentOriginRowIndexRef.current !== null) {
            virtuosoRef.current?.scrollToIndex({
                index: agentOriginRowIndexRef.current,
                align: 'center',
                behavior: 'smooth',
            });
            agentOriginRowIndexRef.current = null;
        }
        agentWasRunningRef.current = agentView.running;
    }, [agentView.running, currentRowIndex]);

    const handleRangeChanged = ({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
        setAwayFromCurrent(
            currentRowIndex >= 0 && (currentRowIndex < startIndex || currentRowIndex > endIndex),
        );
    };

    const scrollBackToCurrent = () => {
        if (currentRowIndex < 0) {
            return;
        }
        virtuosoRef.current?.scrollToIndex({
            index: currentRowIndex,
            align: 'center',
            behavior: 'smooth',
        });
        setAwayFromCurrent(false);
    };

    return (
        <Card className={cn(
            'relative flex h-[360px] min-h-[360px] max-h-[360px] shrink-0 flex-col overflow-hidden border-border/60 bg-card/70 shadow-none',
            agentView.active && 'ring-2 ring-primary/45 shadow-[0_0_22px_hsl(var(--primary)/0.24)]',
            agentView.error && 'ring-2 ring-destructive/40',
        )}>
            {agentView.searchQuery && (
                <div className={cn(
                    'absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border/70 bg-background/95 px-2 py-1 shadow-md backdrop-blur-sm',
                    agentView.active && 'ring-2 ring-primary/45 shadow-[0_0_16px_hsl(var(--primary)/0.28)]',
                )}>
                    <span className="rounded border border-border/70 bg-muted/60 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                        Ctrl+F
                    </span>
                    <Search className="size-3 text-muted-foreground" />
                    <span className="max-w-32 truncate text-xs text-foreground">{agentView.searchQuery}</span>
                    {agentView.searchMatches.length > 0 && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-normal">
                            {agentView.searchMatches.length}
                        </Badge>
                    )}
                </div>
            )}
            <div className="min-h-0 flex-1 px-1">
                <Virtuoso
                    ref={virtuosoRef}
                    data={sentences}
                    style={{ height: '100%' }}
                    className="scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-muted-foreground/25 hover:scrollbar-thumb-muted-foreground/45 scrollbar-track-transparent"
                    increaseViewportBy={300}
                    rangeChanged={handleRangeChanged}
                    itemContent={(_index, sentence) => {
                        const isCurrent = currentSentence?.index === sentence.index && currentSentence.fileHash === sentence.fileHash;
                        const isMatch = matchedIndexes.has(sentence.index);
                        return (
                            <div
                                className={cn(
                                    'mx-1 my-px rounded-md border border-transparent px-2 py-1 text-sm leading-5 text-foreground/80 transition-colors',
                                    isCurrent && 'border-primary/20 bg-primary/5',
                                    isMatch && 'border-primary/30 bg-primary/10 text-foreground',
                                    highlightedIndex === sentence.index && 'border-primary/50 bg-primary/15 shadow-[0_0_14px_hsl(var(--primary)/0.25)]',
                                )}
                                onContextMenu={() => updateInternalContext(sentence.text)}
                                aria-current={isCurrent ? 'true' : undefined}
                            >
                                <span className="mr-2 select-none font-mono text-[10px] text-muted-foreground/60">
                                    {sentence.index + 1}
                                </span>
                                {sentence.text}
                            </div>
                        );
                    }}
                    components={{
                        Footer: () => <div className="h-4" />,
                    }}
                />
            </div>
            {awayFromCurrent && (
                <Button
                    className="absolute bottom-3 right-3 size-8 rounded-full border border-border/70 bg-background/95 p-0 shadow-md"
                    size="icon"
                    variant="outline"
                    onClick={scrollBackToCurrent}
                    title="回到当前字幕"
                    aria-label="回到当前字幕"
                >
                    <LocateFixed className="size-4" />
                </Button>
            )}
        </Card>
    );
};

export default TopicSelector;
