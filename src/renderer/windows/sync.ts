import useSystem from '../hooks/useSystem';

const api = window.electron;
const syncStatus = () => {
    api.onMaximize(() => {
        useSystem.setState({
            isMaximized: true,
        });
    });
    api.onUnMaximize(() => {
        useSystem.setState({
            isMaximized: false,
        });
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
};

export default syncStatus;
