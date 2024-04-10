import {cn} from "@/fronted/lib/utils";
import {IconOpenAI} from "@/fronted/components/chat/icons";
import Md from "@/fronted/components/chat/markdown";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";

export function AiNormalMsg({msg}: { msg: AiNormalMessage }) {
    return (
        <div className={cn('group relative flex items-start')}>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
                <Md>
                    {msg.content}
                </Md>
            </div>
        </div>
    );
}
