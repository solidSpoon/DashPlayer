import {cn} from "@/fronted/lib/utils";
import {Card, CardContent, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const api = window.electron;
const ChatLeftGrammers = ({className}: {
    className: string,
}) => {
    const res = useChatPanel(state => state.newGrammar);
    return (
        <div className={cn('flex flex-col', className)}>
            <Card className={'shadow-none'}>
                <CardHeader>
                    <CardTitle>本句语法</CardTitle>
                    {/*<CardDescription>Manage player settings and behavior</CardDescription>*/}
                </CardHeader>
                <CardContent>
                    {res?.hasGrammar && res?.grammars?.map((g, i) => (
                        <div key={i} className="flex flex-col items-start px-4 py-2">
                            <div className="flex flex-col items-start text-md text-gray-700 text-base">
                                <div className={cn('text-lg font-medium leading-none')}>{g.description}</div>
                            </div>
                        </div>
                    ))}
                    {!res && <div className="text-lg text-gray-700">分析短语中...</div>}
                    {res && !res.hasGrammar && <div className="text-lg text-gray-700">没有语法</div>}
                </CardContent>
            </Card>
        </div>
    )
}

export default ChatLeftGrammers;
