import {cn} from "@/fronted/lib/utils";
import ChatRightSentences from "@/fronted/components/chat/ChatRightSentences";
import ChatRightSumary from "@/fronted/components/chat/ChatTopicSelector";
import SentenceC from "@/common/types/SentenceC";

const api = window.electron;
const ChatRight = ({sentence, className, points}: {
    sentence: SentenceC,
    points: string[],
    className: string,
}) => {
    return (
        <div className={cn('w-full flex flex-col gap-4 pr-6 px-10 overflow-y-auto')}>
            <ChatRightSumary sentenceT={sentence} points={points} className={cn('flex-shrink-0',className)}/>
            <ChatRightSentences sentence={sentence.text} points={points} className={cn('flex-shrink-0',className)}/>
        </div>
    )
}

export default ChatRight;
