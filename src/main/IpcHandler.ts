import { ipcMain } from 'electron';
import log from 'electron-log';
import {
    updateProgress,
    queryProgress,
} from './controllers/ProgressController';
import batchTranslate from './controllers/Translate';
import transWord from './controllers/AppleTrans';

export default function registerHandler() {
    ipcMain.on('update-process', async (event, arg) => {
        log.info('ipcMain update-process', arg);
        event.reply('update-process', 'success');
    });
    ipcMain.on('trans-word', async (event, arg) => {
        log.info('trans-words', arg);
        transWord(arg[0]);
        event.reply('update-process', 'success');
    });
    ipcMain.on('update-progress', async (event, args: never[]) => {
        const [fileName, progress] = args;
        log.info('update-progress', fileName, progress);
        await updateProgress(fileName, progress);
        event.reply('update-progress', 'success');
    });
    ipcMain.on('query-progress', async (event, args: never[]) => {
        const [fileName] = args;
        log.info('query-progress', fileName);
        const progress = await queryProgress(fileName);
        log.info(`query-progress file: ${fileName}, progress: ${progress}`);
        event.reply('query-progress', progress);
    });
    ipcMain.on('batch-translate', async (event, args: never[]) => {
        const strs = args[0];
        log.info('batch-translate');
        const translateResult = await batchTranslate(strs);
        log.info('server tranlate result', translateResult);
        event.reply('batch-translate', translateResult);
    });
}
