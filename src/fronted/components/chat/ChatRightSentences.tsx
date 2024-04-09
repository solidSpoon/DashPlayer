import {cn} from "@/fronted/lib/utils";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const ChatRightSentences = ({className}: {
    className: string,
}) => {

    const res = useChatPanel(state => state.newSentence);
    console.log('res', res)
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            {/*<h2>*/}
            {/*    例句:*/}
            {/*</h2>*/}
            {res?.sentences?.map((s, i) => (
                <div key={i}
                     className="bg-secondary flex flex-col justify-between px-4 py-2 rounded">
                    <Playable className="text-base text-gray-700 text-secondary-foreground">{s?.sentence}</Playable>
                    <div className=" text-sm text-gray-500">{s?.meaning}</div>
                    <div className={'flex flex-wrap gap-2 mt-2'}>
                        {
                            s?.points?.map((p, j) => (
                                <div key={j}
                                     className="text-xs border p-1 py-0 bg-red-50 border-red-500 text-primary-foreground rounded-full">{p}</div>
                            ))
                        }
                    </div>


                </div>
            ))}
            {!res && <div className="text-lg text-gray-700">生成例句中...</div>}
            {/*    </CardContent>*/}
            {/*</Card>*/}
            {/*{(res?.sentences??[]). && <div className="text-lg text-gray-700">没有生词</div>}*/}
        </div>

    )
}

export default ChatRightSentences;
