import { ipcMain } from 'electron';
import log from 'electron-log';
import {
    updateProgress,
    queryProgress,
} from './controllers/ProgressController';
import batchTranslate from './controllers/Translate';
import transWord from './controllers/AppleTrans';
import {
    updateTencentSecret,
    getTencentSecret,
    updateYouDaoSecret,
    getYouDaoSecret,
} from './controllers/SecretController';
import youDaoTrans from './controllers/YouDaoTrans';

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

    ipcMain.on('update-tenant-secret', async (event, args: never[]) => {
        const [secretId, secretKey] = args;
        log.info('update-tenant-secret');
        await updateTencentSecret(secretId, secretKey);
        event.reply('update-tenant-secret', 'success');
    });
    ipcMain.on('get-tenant-secret', async (event) => {
        log.info('get-tenant-secret');
        const result: string[] = await getTencentSecret();
        event.reply('get-tenant-secret', result);
    });

    ipcMain.on('update-you-dao-secret', async (event, args: never[]) => {
        const [secretId, secretKey] = args;
        log.info('update-you-dao-secret');
        await updateYouDaoSecret(secretId, secretKey);
        event.reply('update-you-dao-secret', 'success');
    });
    ipcMain.on('get-you-dao-secret', async (event) => {
        log.info('get-you-dao-secret');
        const result: string[] = await getYouDaoSecret();
        event.reply('get-you-dao-secret', result);
    });

    ipcMain.on('is-windows', async (event) => {
        log.info('is-windows');
        const isWindows = process.platform === 'win32';
        event.reply('is-windows', isWindows);
    });
    ipcMain.on('you-dao-translate', async (event, args: string[]) => {
        log.info('you-dao-translate');
        const word = args[0];
        const result = await youDaoTrans(word);
        event.reply('you-dao-translate', result);
    });
}
