import {cn} from "@/fronted/lib/utils";
import {PiSpeakerSimpleHigh} from "react-icons/pi";

export interface PlayableProps {
    className?: string;
    children?: string;
}

const Playable = ({className, children}: PlayableProps) => {
    return (
        <span className={cn(' cursor-pointer hover:underline', className)}>
            {children}
            <PiSpeakerSimpleHigh className={'inline-block ml-1'}/>
        </span>
    )
}

Playable.defaultProps = {
    className: '',
    children: ''
}

export default Playable;
