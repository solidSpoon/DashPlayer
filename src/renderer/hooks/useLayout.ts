import { create, UseBoundStore } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const api = window.electron;
export type ScreenSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
const SCREEN_SIZES: ScreenSize[] = ['sm', 'md', 'lg', 'xl', '2xl'];
export type UseLayoutState = {
    showSideBar: boolean;
    titleBarHeight: number;
    width: ScreenSize;
    height: ScreenSize;
};

export type UseLayoutActions = {
    changeSideBar: (show: boolean) => void;
};

const useLayout = create<UseLayoutState & UseLayoutActions>()(
    subscribeWithSelector((set) => ({
        showSideBar: true,
        titleBarHeight: 0,
        width: '2xl',
        height: '2xl',
        changeSideBar: (show: boolean) => {
            set({ showSideBar: show });
        },
    }))
);
api.isWindows().then((isWindows) => {
    if (isWindows) {
        useLayout.setState({ titleBarHeight: 28 });
    } else {
        useLayout.setState({ titleBarHeight: 0 });
    }
});

const updateSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let w: ScreenSize = '2xl';
    let h: ScreenSize = '2xl';
    if (width < 640) {
        w = 'sm';
    } else if (width < 768) {
        w = 'md';
    } else if (width < 1024) {
        w = 'lg';
    } else if (width < 1280) {
        w = 'xl';
    }
    if (height < 500) {
        h = 'sm';
    } else if (height < 600) {
        h = 'md';
    } else if (height < 700) {
        h = 'lg';
    } else if (height < 800) {
        h = 'xl';
    }

    useLayout.setState({ width: w, height: h });
};

export const cpW = (screen: ScreenSize, condition: ScreenSize) => {
    return (SCREEN_SIZES.indexOf(condition) <=
        SCREEN_SIZES.indexOf(screen)) as boolean;
};

export const cpH = (screen: ScreenSize, condition: ScreenSize) => {
    return (SCREEN_SIZES.indexOf(condition) <=
        SCREEN_SIZES.indexOf(screen)) as boolean;
};

updateSize();
window.addEventListener('resize', updateSize);

export default useLayout;
