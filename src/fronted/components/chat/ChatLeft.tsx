import {useEffect, useState} from "react";
import useDpTask from "@/fronted/hooks/useDpTask";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {AiAnalyseNewWordsRes} from "@/common/types/AiAnalyseNewWordsRes";
import {cn} from "@/fronted/lib/utils";
import {strBlank} from "@/common/utils/Util";
import ChatLeftPhrases from "@/fronted/components/chat/ChatLeftPhrases";
import ChatLeftWords from "@/fronted/components/chat/ChatLeftWords";

const api = window.electron;
const ChatLeft = ({sentence, className, updateWordPoint, updatePhrasePoint}: {
    sentence: string,
    className: string,
    updateWordPoint: (p: string[]) => void;
    updatePhrasePoint: (p: string[]) => void;
}) => {
    return (
        <div className={cn('w-full flex flex-col gap-4')}>
            <ChatLeftWords sentence={sentence} className={className} updatePoint={updateWordPoint}/>
            <ChatLeftPhrases sentence={sentence} className={className} updatePoint={updatePhrasePoint}/>
        </div>
    )
}

export default ChatLeft;
