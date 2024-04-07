import {cn} from "@/fronted/lib/utils";
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
        <div className={cn('w-full flex overflow-y-auto h-full flex-col gap-4 pl-6 pr-10')}>

            <ChatLeftWords sentence={sentence}
                           className={cn('flex-shrink-0', className)}
                           updatePoint={updateWordPoint}/>
            <ChatLeftPhrases sentence={sentence} className={cn('flex-shrink-0', className)} updatePoint={updatePhrasePoint}/>
            <ChatLeftPhrases sentence={sentence} className={cn('flex-shrink-0', className)} updatePoint={updatePhrasePoint}/>
        </div>
    )
}

export default ChatLeft;
