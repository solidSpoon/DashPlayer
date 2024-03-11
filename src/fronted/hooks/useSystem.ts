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
            set({ windowState: windowsState }),
    }))
);

export const syncStatus = (main: boolean) => {
    if (main) {
        api.onMainState((state) => {
            useSystem.setState({
                windowState: state,
            });
        });
    } else {
        api.onSettingState((state) => {
            useSystem.setState({
                windowState: state,
            });
        });
    }

    useSystem.setState({
        isMain: main,
    });
    // eslint-disable-next-line promise/always-return,promise/catch-or-return
    api.isWindows().then((isWindows) => {
        useSystem.setState({
            isWindows,
        });
    });
    // eslint-disable-next-line promise/catch-or-return,promise/always-return
    api.appVersion().then((appVersion) => {
        useSystem.setState({
            appVersion,
        });
    });

    useSystem.subscribe(
        (s) => s.windowState,
        (state) => {
            if (main) {
                api.setMainState(state);
            } else {
                api.setSettingState(state);
            }
        }
    );
    useSystem.subscribe(console.log);
};

export default useSystem;
