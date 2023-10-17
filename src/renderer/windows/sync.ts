import useSystem from '../hooks/useSystem';
import useSetting from '../hooks/useSetting';

const api = window.electron;
const syncStatus = (main: boolean) => {
    if (main) {
        api.onMaximize(() => {
            useSystem.setState({
                windowState: 'maximized',
            });
        });
        api.onUnMaximize(() => {
            useSystem.setState({
                windowState: 'normal',
            });
        });
        api.onFullScreen(() => {
            useSystem.setState({
                windowState: 'fullscreen',
            });
        });
    } else {
        api.onSettingMaximize(() => {
            useSystem.setState({
                windowState: 'maximized',
            });
        });
        api.onSettingUnMaximize(() => {
            useSystem.setState({
                windowState: 'normal',
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
                switch (state) {
                    case 'maximized':
                        api.maximize();
                        break;
                    case 'minimized':
                        api.minimize();
                        break;
                    case 'fullscreen':
                        api.fullscreen();
                        break;
                    case 'closed':
                        api.close();
                        break;
                    case 'normal':
                        api.unMaximize();
                        break;
                    default:
                        break;
                }
            } else {
                switch (state) {
                    case 'maximized':
                        api.maximizeSetting();
                        break;
                    case 'minimized':
                        api.minimizeSetting();
                        break;
                    case 'fullscreen':
                        api.fullscreen();
                        break;
                    case 'closed':
                        api.closeSetting();
                        break;
                    case 'normal':
                        api.unMaximizeSetting();
                        break;
                    default:
                        break;
                }
            }
        }
    );
    useSystem.subscribe(console.log);
};

const syncSetting = () => {

};

export default syncStatus;
