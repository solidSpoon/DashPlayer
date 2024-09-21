import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import PathUtil from '@/fronted/lib/PathUtil';

const api = window.electron;
type State = {
    isWindows: boolean;
    pathSeparator: string;
};

type Actions = {
    setIsWin: (isWin: boolean) => void;
};

const useSystem = create(
    subscribeWithSelector<State & Actions>((set) => ({
        isWindows: false,
        pathSeparator: '',
        appVersion: '',
        windowState: 'normal',
        setIsWin: (isWin: boolean) => set({isWindows: isWin}),
    }))
);

export const syncStatus = () => {
    api.call('system/info', null).then((sysInfo) => {
        useSystem.setState({
            isWindows: sysInfo.isWindows,
            pathSeparator: sysInfo.pathSeparator,
        });
        PathUtil.SEPARATOR = sysInfo.pathSeparator;
    });
};

export default useSystem;
