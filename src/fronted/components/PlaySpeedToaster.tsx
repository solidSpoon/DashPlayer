import {cn} from "@/fronted/lib/utils";
import {useEffect, useRef, useState} from "react";

const PlaySpeedToaster = ({speed, className}: {
    speed: number;
    className?: string;

}) => {
    const localSpeed = useRef(speed);
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (localSpeed.current !== speed) {
            localSpeed.current = speed;
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
            }, 1000);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [speed]);
    return (
        show ? <div className={cn("bg-stone-300 rounded text-black px-4 py-2 pr-3 flex text-2xl", className)}>
            Speed: <span className={cn('ml-2 w-12', speed >= 10 && 'w-16')}>{speed.toFixed(2)}</span>x
        </div> : <></>
    )
}

export default PlaySpeedToaster;