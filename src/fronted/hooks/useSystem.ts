import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { WindowState } from '@/common/types/Types';

const api = window.electron;
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
            set({ windowState: windowsState })
    }))
);

export const syncStatus = () => {

    api.onMainState((state) => {
        useSystem.setState({
            windowState: state
        });
    });


    api.isWindows().then((isWindows) => {
        useSystem.setState({
            isWindows
        });
    });

    api.appVersion().then((appVersion) => {
        useSystem.setState({
            appVersion
        });
    });

    useSystem.subscribe(
        (s) => s.windowState,
        (state) => {
            api.setMainState(state);
        }
    );
    useSystem.subscribe(console.log);
};

export default useSystem;
