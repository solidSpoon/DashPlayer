import {cn} from "@/fronted/lib/utils";
import {useEffect, useRef, useState} from "react";
import usePlayerToaster from '@/fronted/hooks/usePlayerToaster';

const PlayerToaster = ({ className}: {
    className?: string;

}) => {
    const type = usePlayerToaster(s=>s.type);
    const text = usePlayerToaster(s=>s.text);

    // 等宽字体
    return (
        type!== 'none' ? <div className={cn("bg-stone-300 rounded text-black px-4 py-2 pr-3 flex text-2xl font-mono", className)}>
            {text}
        </div> : <></>
    )
}

export default PlayerToaster;
