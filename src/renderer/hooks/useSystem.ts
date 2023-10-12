import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type WindowState =
    | 'normal'
    | 'maximized'
    | 'minimized'
    | 'fullscreen'
    | 'closed';

type State = {
    isWindows: boolean;
    windowState: WindowState;
    isMain: boolean;
    appVersion: string;
};

type Actions = {
    setIsWin: (isWin: boolean) => void;
    setWindowState: (windowsState: WindowState) => void;
    setAppVersion: (appVersion: string) => void;
    setIsMain: (isMain: boolean) => void;
};

const useSystem = create(
    subscribeWithSelector<State & Actions>((set) => ({
        isWindows: false,
        appVersion: '',
        isMain: true,
        windowState: 'normal',
        setIsWin: (isWin: boolean) => set({ isWindows: isWin }),
        setAppVersion: (appVersion: string) => set({ appVersion }),
        setIsMain: (isMain: boolean) => set({ isMain }),
        setWindowState: (windowsState: WindowState) =>
            set({ windowState: windowsState }),
    }))
);

export default useSystem;
