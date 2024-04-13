import {ipcMain} from "electron";
import {ApiMap} from "@/common/api/api-def";


export default function registerRoute<K extends keyof ApiMap>(path: K, func: ApiMap[K]) {
    ipcMain.handle(path, (_event, param) => {
        console.log('testcall', param);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return func(param);
    });
}
