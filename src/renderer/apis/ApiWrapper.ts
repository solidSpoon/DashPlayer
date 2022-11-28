import { Channels } from '../../main/preload';

export default async function callApi(
    name: Channels,
    args: any[]
): Promise<unknown> {
    return new Promise((resolve) => {
        window.electron.ipcRenderer.sendMessage(name, args);
        window.electron.ipcRenderer.once(name, (result: unknown) => {
            resolve(result);
        });
    });
}
