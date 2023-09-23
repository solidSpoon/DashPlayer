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
import youDaoTrans, { playSound } from './controllers/YouDaoTrans';
import { getShortCut, updateShortCut } from './controllers/ShortCutController';
import { createSettingWindowIfNeed, mainWindow, settingWindow } from './main';

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
    ipcMain.on('pronounce', async (event, args: string[]) => {
        log.info('pronounce', args[0]);
        const success = await playSound(args[0]);
        event.reply('pronounce', success);
    });
    ipcMain.on('update-shortcut', async (event, args: string[]) => {
        log.info('update-shortcut');
        const [shortcut] = args;
        const success = await updateShortCut(shortcut);
        event.reply('update-shortcut', success);
    });
    ipcMain.on('get-shortcut', async (event) => {
        log.info('get-shortcut');
        const shortcut = await getShortCut();
        event.reply('get-shortcut', shortcut);
    });
    ipcMain.on('maximize', async (event) => {
        log.info('maximize');
        mainWindow?.maximize();
        event.reply('maximize', 'success');
    });
    ipcMain.on('unmaximize', async (event) => {
        log.info('unmaximize');
        mainWindow?.unmaximize();
        event.reply('unmaximize', 'success');
    });
    ipcMain.on('is-maximized', async (event) => {
        log.info('is-maximized');
        event.reply('is-maximized', mainWindow?.isMaximized());
    });
    ipcMain.on('is-full-screen', async (event) => {
        log.info('is-full-screen');
        event.reply('is-full-screen', mainWindow?.isFullScreen());
    });
    ipcMain.on('show-button', async (event) => {
        log.info('show-button');
        // 展示红绿灯
        if (process.platform === 'darwin') {
            mainWindow?.setWindowButtonVisibility(true);
        }
        event.reply('show-button', 'success');
    });
    ipcMain.on('hide-button', async (event) => {
        log.info('hide-button');
        // 隐藏红绿灯
        if (process.platform === 'darwin') {
            mainWindow?.setWindowButtonVisibility(false);
        }

        event.reply('hide-button', 'success');
    });
    ipcMain.on('minimize', async (event) => {
        log.info('minimize');
        mainWindow?.minimize();
        event.reply('minimize', 'success');
    });
    ipcMain.on('close', async (event) => {
        log.info('close');
        mainWindow?.close();
        event.reply('close', 'success');
    });
    ipcMain.on('open-menu', async (event) => {
        log.info('open-menu');
        // create or show setting window
        await createSettingWindowIfNeed();
        settingWindow?.show();
        event.reply('open-menu', 'success');
    });
    ipcMain.on('maximize-setting', async (event) => {
        log.info('maximize-setting');
        settingWindow?.maximize();
        event.reply('maximize-setting', 'success');
    });
    ipcMain.on('unmaximize-setting', async (event) => {
        log.info('unmaximize-setting');
        settingWindow?.unmaximize();
        event.reply('unmaximize-setting', 'success');
    });
    ipcMain.on('is-maximized-setting', async (event) => {
        log.info('is-maximized-setting');
        event.reply('is-maximized-setting', settingWindow?.isMaximized());
    });
    ipcMain.on('close-setting', async (event) => {
        log.info('close-setting');
        settingWindow?.close();
        event.reply('close-setting', 'success');
    });
    ipcMain.on('minimize-setting', async (event) => {
        log.info('minimize-setting');
        settingWindow?.minimize();
        event.reply('minimize-setting', 'success');
    });
}
