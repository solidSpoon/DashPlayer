import React, { useState } from 'react';
import useSWR from 'swr';
import { YdRes } from '@/common/types/YdRes';
import { Loader2, SendToBack } from 'lucide-react';
import { useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import { ScrollArea } from '@/fronted/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/fronted/components/ui/tabs';
import { cn } from '@/fronted/lib/utils';

const api = window.electron;

interface WordListWordProps {
    word: string;
    sentences: { index: number; text: string }[];
    isOpen: boolean;
    onToggle: () => void;
}

const WordListWord: React.FC<WordListWordProps> = ({ word, sentences, isOpen, onToggle }) => {

    const { data: ydResp, isLoading } = useSWR<YdRes | null>(
        isOpen ? ['ai-trans/word', word] : null,
        ([_key, wordToTranslate]) => api.call('ai-trans/word', wordToTranslate)
    );

    const { refs, context } = useFloating({
        open: isOpen,
        onOpenChange: onToggle,
        placement: 'bottom-start',
    });

    const dismiss = useDismiss(context);
    const click = useClick(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

    const handleJumpToSentence = (sentenceIndex: number) => {
        const sentenceToJump = usePlayerController.getState().subtitle.find(s => s.index === sentenceIndex);
        if (sentenceToJump) {
            usePlayerController.getState().jump(sentenceToJump);
        }
        onToggle(); // Close popover after jumping
    };

    return (
        <>
            {/* 1. The trigger element is always visible */}
            <span
                ref={refs.setReference}
                {...getReferenceProps()}
                className="cursor-pointer hover:bg-muted p-1 rounded transition-colors duration-200"
            >
                {word}
            </span>

            {/* 2. The floating popover content */}
            {isOpen && (
                <div
                    ref={refs.setFloating}
                    style={{
                        position: context.strategy,
                        top: context.y ?? 0,
                        left: context.x ?? 0,
                    }}
                    {...getFloatingProps()}
                    className="z-50"
                >
                    {/* 3. The content of the popover is the Tabs component */}
                    <Tabs defaultValue="translation" className="w-96 bg-background border rounded-lg shadow-lg">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="translation">Word Card</TabsTrigger>
                            <TabsTrigger value="sentences">Sentences</TabsTrigger>
                        </TabsList>

                        <TabsContent value="translation" className="p-0 m-0">
                            {(isLoading || !ydResp) && (
                                <div className="flex items-center justify-center h-96">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            )}
                            {ydResp?.webdict?.url && (
                                <div className="h-96 w-full overflow-hidden">
                                     <iframe
                                        className="w-full h-[calc(100%+50px)] -mt-[50px]" // Replicate the offset from WordPop
                                        src={ydResp.webdict.url}
                                        title="dict"
                                    />
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="sentences" className="p-4">
                            <ScrollArea className="h-96 w-full">
                                <div className="flex flex-col gap-2 pr-4">
                                    {sentences.map((sentence) => (
                                        <div
                                            key={sentence.index}
                                            onClick={() => handleJumpToSentence(sentence.index)}
                                            className="text-xs text-muted-foreground p-2 hover:bg-muted rounded cursor-pointer flex items-start gap-2"
                                        >
                                            <SendToBack className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            <span className="flex-1">{sentence.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </>
    );
};

export default WordListWord;
