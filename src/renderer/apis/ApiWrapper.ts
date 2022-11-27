import { Channels } from "../../main/preload";

export async function callApi(name: Channels, args: any[]): Promise<any> {
    console.log(`request api ${name}, args: ${args}`);
    return new Promise((resolve, reject) => {
        window.electron.ipcRenderer.sendMessage(name, args);
        window.electron.ipcRenderer.once(name, (result) => {
            console.log(`get result from api ${name}, result: ${result}`);
            resolve(result);
        });
    });

}
