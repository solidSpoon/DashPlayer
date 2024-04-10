import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import useDpTask from "@/fronted/hooks/useDpTask";
import {AiPhraseGroupRes} from "@/common/types/aiRes/AiPhraseGroupRes";
import {cn} from "@/fronted/lib/utils";

const HumanTopicMsg = ({msg}:{msg: HumanTopicMessage}) => {

    const dpTask = useDpTask(msg.phraseGroupTask, 200);

    const res = JSON.parse(dpTask?.result??'{}') as AiPhraseGroupRes;
    const colors = ['bg-rose-100/80', 'bg-sky-100/80', 'bg-green-100/80', 'bg-orange-100/80'];
    console.log('HumanTopicMsg', msg)
    return (
        <div className={cn('text-lg flex flex-wrap gap-2')}>
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
