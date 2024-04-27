import {ipcMain} from 'electron';
import log from 'electron-log';
import axios from 'axios';
import StorageController from './controllers/StorageController';
import {Channels} from '@/preload';
import SubtitleTimestampAdjustmentController from '@/backend/controllers/SubtitleTimestampAdjustmentController';
import fs from 'fs';
import Controller from "@/backend/interfaces/controller";
import AiFuncController from "@/backend/controllers/AiFuncController";
import SystemController from "@/backend/controllers/SystemController";
import DpTaskController from "@/backend/controllers/DpTaskController";
import AiTransController from "@/backend/controllers/AiTransController";
import WatchProjectController from '@/backend/controllers/WatchProjectController';
import SubtitleController from '@/backend/controllers/SubtitleController';
import MediaController from "@/backend/controllers/MediaController";


const handle = (
    channel: Channels,
    listenerWrapper: (...args: any[]) => Promise<void> | any
): void => {
    ipcMain.handle(channel, (event, ...args) => {
        return listenerWrapper(...args);
    });
};

const controllers: Controller[] = [
    new AiFuncController(),
    new SystemController(),
    new DpTaskController(),
    new AiTransController(),
    new WatchProjectController(),
    new SubtitleController(),
    new MediaController(),
    new SubtitleTimestampAdjustmentController(),
    new StorageController(),
]

export default function registerHandler(mainWindowRef: { current: Electron.CrossProcessExports.BrowserWindow }) {
    handle('get-audio', async (url) => {
        log.info('get-audio', url);
        const response = await axios.get(url, {responseType: 'arraybuffer'});
        return response.data;
    });
    handle('open-file', async (path: string) => {
        log.info('open-file', path);
        // 如果文件存在, 则返回文件流, 否则返回null
        // 检查文件是否存在
        if (!fs.existsSync(path)) {
            log.info('open-file', '文件不存在');
            return null;
        }

        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(Buffer.from(data));
            });
        });
    });
    controllers.forEach((controller) => {
        controller.registerRoutes();
    });
}
