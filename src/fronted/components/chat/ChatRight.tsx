import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {AiAnalyseNewWordsRes} from "@/common/types/AiAnalyseNewWordsRes";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import ChatLeftPhrases from "@/fronted/components/chat/ChatLeftPhrases";
import ChatLeftWords from "@/fronted/components/chat/ChatLeftWords";
import ChatRightSentences from "@/fronted/components/chat/ChatLeftRightSentences";

const api = window.electron;
const ChatRight = ({sentence, className, points}: {
    sentence: string,
    points: string[],
    className: string,
    // updateWordPoint: (p: string[]) => void;
    // updatePhrasePoint: (p: string[]) => void;
}) => {
    return (
        <div className={cn('w-full flex flex-col gap-4')}>
            <ChatRightSentences sentence={sentence} points={points} className={className}/>
        </div>
    )
}

export default ChatRight;
