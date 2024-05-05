import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {WindowState} from '@/common/types/Types';

const api = window.electron;
type State = {
    isWindows: boolean;
};

type Actions = {
    setIsWin: (isWin: boolean) => void;
};

const useSystem = create(
    subscribeWithSelector<State & Actions>((set) => ({
        isWindows: false,
        appVersion: '',
        windowState: 'normal',
        setIsWin: (isWin: boolean) => set({isWindows: isWin}),
    }))
);

export const syncStatus = () => {
    api.call('system/is-windows', null).then((isWindows) => {
        useSystem.setState({
            isWindows
        });
    });
};

export default useSystem;
