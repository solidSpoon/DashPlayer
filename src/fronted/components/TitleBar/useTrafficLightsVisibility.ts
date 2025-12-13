import { useCallback, useEffect, useRef, useState } from 'react';

export type TrafficLightsVisibility = {
    visible: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onMouseMove: () => void;
};

export default function useTrafficLightsVisibility(
    showSideBar: boolean,
    hideDelayMs = 1000,
): TrafficLightsVisibility {
    const [visible, setVisible] = useState(false);

    const showSideBarRef = useRef(showSideBar);
    const hoveringRef = useRef(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        showSideBarRef.current = showSideBar;
    }, [showSideBar]);

    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    }, []);

    const showNow = useCallback(() => {
        setVisible((prev) => (prev ? prev : true));
    }, []);

    const scheduleHide = useCallback(() => {
        clearHideTimeout();
        if (showSideBarRef.current || hoveringRef.current) {
            return;
        }
        hideTimeoutRef.current = setTimeout(() => {
            if (!showSideBarRef.current && !hoveringRef.current) {
                setVisible(false);
            }
        }, hideDelayMs);
    }, [clearHideTimeout, hideDelayMs]);

    useEffect(() => {
        if (showSideBar) {
            showNow();
            clearHideTimeout();
            return;
        }
        showNow();
        scheduleHide();
    }, [clearHideTimeout, scheduleHide, showNow, showSideBar]);

    useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

    const onMouseEnter = useCallback(() => {
        hoveringRef.current = true;
        showNow();
        clearHideTimeout();
    }, [clearHideTimeout, showNow]);

    const onMouseLeave = useCallback(() => {
        hoveringRef.current = false;
        scheduleHide();
    }, [scheduleHide]);

    const onMouseMove = useCallback(() => {
        showNow();
        scheduleHide();
    }, [scheduleHide, showNow]);

    return {
        visible,
        onMouseEnter,
        onMouseLeave,
        onMouseMove,
    };
}
