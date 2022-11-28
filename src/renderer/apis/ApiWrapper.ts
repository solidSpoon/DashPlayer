import { Channels } from '../../main/preload';

export default async function callApi(
    name: Channels,
    args: any[]
): Promise<unknown> {
    console.log(`request api ${name}, args: ${args}`);
    return new Promise((resolve, reject) => {
        try {
            window.electron.ipcRenderer.sendMessage(name, args);
            window.electron.ipcRenderer.once(name, (result: unknown) => {
                console.log(`get result from api ${name}, result: ${result}`);
                resolve(result);
            });
        } catch (e) {
            console.log(`call api failed, api ${name}, ${e}`);
            reject(e);
        }
    });
}
