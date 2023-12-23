import { createRoot } from 'react-dom/client';
import Notification from '../../components/Notification';
import { syncStatus } from '../../hooks/useSystem';
import 'tailwindcss/tailwind.css';
const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
    <>
        <Notification />
        {/*<SettingRouter />*/}
    </>
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
    // eslint-disable-next-line no-console
    console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
syncStatus(false);
