import { useEffect, useRef, useState } from 'react';
import useSystem from './useSystem';
import useLayout from './useLayout';

export interface Ele {
    /**
     * y 顶部
     */
    yt: number;
    /**
     * y 底部
     */
    yb: number;
}
const useBoundary = () => {
    const boundaryRef = useRef<HTMLDivElement>(null);
    const [boundary, setBoundary] = useState<Ele | undefined>(undefined);
    const isWindows = useSystem((state) => state.isWindows);
    const showSideBar = useLayout((state) => state.showSideBar);
    useEffect(() => {
        const updateBoundary = () => {
            // 窗口高度
            const wh = boundaryRef.current?.getBoundingClientRect().height ?? 0;
            // 顶部高度
            setBoundary({
                yt: isWindows ? 27 : 7,
                yb: wh - 15,
            });
        };
        const timeout = setTimeout(() => {
            updateBoundary();
        }, 5000);
        updateBoundary();
        window.addEventListener('resize', updateBoundary);
        return () => {
            window.removeEventListener('resize', updateBoundary);
            clearTimeout(timeout);
        };
    }, [boundaryRef, isWindows, showSideBar]);

    return {
        setBoundaryRef: boundaryRef,
        boundary,
    };
};

export default useBoundary;
