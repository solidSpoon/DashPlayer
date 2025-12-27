import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import PathUtil from '@/common/utils/PathUtil';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;
type State = {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    pathSeparator: string;
};

type Actions = {
    setIsWin: (isWin: boolean) => void;
};

const useSystem = create(
    subscribeWithSelector<State & Actions>((set) => ({
        isWindows: false,
        isMac: false,
        isLinux: false,
        pathSeparator: '',
        appVersion: '',
        windowState: 'normal',
        setIsWin: (isWin: boolean) => set({isWindows: isWin}),
    }))
);

export const syncStatus = () => {
    api.call('system/info').then((sysInfo) => {
        useSystem.setState({
            isWindows: sysInfo.isWindows,
            isMac: sysInfo.isMac,
            isLinux: sysInfo.isLinux,
            pathSeparator: sysInfo.pathSeparator,
        });
        PathUtil.SEPARATOR = sysInfo.pathSeparator;
    });
};

syncStatus();

export default useSystem;
