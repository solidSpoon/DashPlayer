import { useEffect } from 'react';
import useSystem from '../hooks/useSystem';
import callApi from '../lib/apis/ApiWrapper';

const api = window.electron;
const SyncState = () => {
    const setIsMaximized = useSystem((s) => s.setIsMaximized);
    const setIsWin = useSystem((s) => s.setIsWindows);
    const setAppVersion = useSystem((s) => s.setAppVersion);
    useEffect(() => {
        const onUnMaximize = api.onUnMaximize(() => {
            setIsMaximized(false);
        });
        const onMaximize = api.onMaximize(() => {
            setIsMaximized(true);
        });
        return () => {
            onUnMaximize();
            onMaximize();
        };
    }, [setIsMaximized]);

    useEffect(() => {
        const init = async () => {
            const isW = (await callApi('is-windows', [])) as boolean;
            setIsWin(isW);
            const appVersion = await api.appVersion();
            setAppVersion(appVersion);
        };
        init();
    }, [setAppVersion, setIsWin]);

    return <></>;
};
export default SyncState;
