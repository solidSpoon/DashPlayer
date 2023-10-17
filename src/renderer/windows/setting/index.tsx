import { createRoot } from 'react-dom/client';
import SettingKey from './SettingKey';
import Notification from '../../components/Notification';
import { syncStatus } from '../../hooks/useSystem';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
    <>
        <Notification />
        <SettingKey />
    </>
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
    // eslint-disable-next-line no-console
    console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
syncStatus(false);
