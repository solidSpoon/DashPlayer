import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import useDpTask from "@/fronted/hooks/useDpTask";
import {AiPhraseGroupRes} from "@/common/types/aiRes/AiPhraseGroupRes";
import {cn} from "@/fronted/lib/utils";
import useChatPanel from '@/fronted/hooks/useChatPanel';

const HumanTopicMsg = ({msg}:{msg: HumanTopicMessage}) => {

    const dpTask = useDpTask(msg.phraseGroupTask, 200);
   const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    const res = JSON.parse(dpTask?.result??'{}') as AiPhraseGroupRes;
    console.log('HumanTopicMsg', msg)
    return (
        <div
            onContextMenu={(e) => {
                updateInternalContext(msg.content);
            }}
            className={cn('text-lg flex flex-wrap gap-2 justify-center mb-4')}>
            {res?.phraseGroups?.map((group, i) => {
                return (
                    <span key={i} className={cn('px-2 py-1 rounded-xl', 'bg-secondary')}>
                        {group.original}
                    </span>
                );
            })}
        </div>
    );
}

export default HumanTopicMsg;
