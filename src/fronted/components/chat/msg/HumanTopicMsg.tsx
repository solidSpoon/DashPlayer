import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import useDpTask from "@/fronted/hooks/useDpTask";
import {AiPhraseGroupRes} from "@/common/types/aiRes/AiPhraseGroupRes";
import {cn} from "@/fronted/lib/utils";

const HumanTopicMsg = ({msg}:{msg: HumanTopicMessage}) => {

    const dpTask = useDpTask(msg.phraseGroupTask, 200);

    const res = JSON.parse(dpTask?.result??'{}') as AiPhraseGroupRes;
    //export interface AiPhraseGroupRes {
    //     sentence: string;
    //     phraseGroups: {
    //         original: string;
    //         translation: string;
    //         comment: string;
    //     }[];
    // }
    //Rose100 Sky100 Green100 Orange100
    const colors = ['bg-rose-100', 'bg-sky-100', 'bg-green-100', 'bg-orange-100'];

    return (
        <div className={cn('text-lg text-gray-400')}>
            {res?.phraseGroups?.map((group, i) => {
                return (
                    <span key={i} className={cn('p-1', colors[i % colors.length])}>
                        {group.original}
                    </span>
                );
            })}
        </div>
    );
}

export default HumanTopicMsg;
