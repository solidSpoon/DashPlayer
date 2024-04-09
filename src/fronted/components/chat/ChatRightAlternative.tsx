import {cn} from "@/fronted/lib/utils";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const ChatRightAlternative = ({className}: {
    className: string,
}) => {

    const res = useChatPanel(state => state.newSentence);
    console.log('res', res)
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            <h2 className={'text-lg text-gray-700'}>
                同义句
            </h2>
            {res?.sentences?.map((s, i) => (
                <li key={i}
                    className="">
                    <Playable className="text-base text-gray-700 text-secondary-foreground inline-block">{s?.sentence}</Playable>
                </li>
            ))}
            {!res && <div className="text-lg text-gray-700">生成例句中...</div>}
        </div>

    )
}

export default ChatRightAlternative;
