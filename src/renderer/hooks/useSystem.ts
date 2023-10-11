import { create } from 'zustand';

type State = {
    isWindows: boolean;
    isMaximized: boolean;
    appVersion: string;
};

type Actions = {
    setIsWindows: (isWin: boolean) => void;
    setIsMaximized: (isMaximized: boolean) => void;
    setAppVersion: (appVersion: string) => void;
};

const useSystem = create<State & Actions>((set) => ({
    isWindows: false,
    isMaximized: false,
    appVersion: '',
    setIsWindows: (isWin: boolean) => set({ isWindows: isWin }),
    setIsMaximized: (isMaximized: boolean) => set({ isMaximized }),
    setAppVersion: (appVersion: string) => set({ appVersion }),
}));

export default useSystem;
