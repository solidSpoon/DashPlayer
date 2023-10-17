import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';
import useSystem, { syncStatus } from '../../hooks/useSystem';

const container = document.getElementById('root')!;
const root = createRoot(container);
const api = window.electron;
root.render(
    <>
        <App />
    </>
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
    // eslint-disable-next-line no-console
    console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
syncStatus(true);
