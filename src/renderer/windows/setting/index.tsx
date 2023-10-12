import { createRoot } from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import SettingKey from './SettingKey';
import 'react-toastify/dist/ReactToastify.css';
import syncStatus from '../sync';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
    <>
        <ToastContainer
            position="top-center"
            autoClose={1000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss={false}
            draggable
            pauseOnHover
            theme="light"
        />
        <SettingKey />
    </>
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
    // eslint-disable-next-line no-console
    console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
syncStatus();
