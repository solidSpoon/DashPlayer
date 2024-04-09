import usePlayerController from "@/fronted/hooks/usePlayerController";
import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import {useEffect, useRef, useState} from "react";
const api = window.electron;
const ChatTopicSelecter = ({className}: {
    className: string,
}) => {

    const currentSentence = usePlayerController(state => state.currentSentence);

    const subtitles = usePlayerController.getState().getSubtitleAround(currentSentence.index, 5);

    const [mouseOver, setMouseOver] = useState(false);

    const currentRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!currentRef.current) {
            return;
        }
        // if (!mouseOver) {
            currentRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
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
    )
}

export default ChatTopicSelecter;
