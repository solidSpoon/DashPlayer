import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import { app, dialog, shell } from 'electron';
import path from 'path';
import { clearDB } from '@/backend/db/db';
import { WindowState } from '@/common/types/Types';
import SystemService from '@/backend/services/SystemService';
import { checkUpdate } from '@/backend/services/CheckUpdate';
import Release from '@/common/types/release';
import { BASE_PATH } from '@/backend/controllers/StorageController';
import Util from '@/common/utils/Util';

/**
 * eg: .mkv -> mkv
 * @param filter
 */
function processFilter(filter: string[]) {
    return filter
        .filter(f => Util.strNotBlank(f))
        .map(f => f.replace(/^\./, ''));
}

export default class SystemController implements Controller {
    public async info() {
        return {
            isWindows: process.platform === 'win32',
            pathSeparator: path.sep
        };
    }

    public async selectFile(filter: string[]): Promise<string[]> {
        const f = processFilter(filter);
        const files = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{
                name: 'Files',
                extensions: f
            }]
        });
        return files.filePaths;
    }

    public async selectFolder(): Promise<string[]> {
        const files = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        return files.filePaths;
    }

    public async pathInfo(p: string): Promise<{
        baseName: string,
        dirName: string,
        extName: string,
    }> {
        return {
            baseName: path.basename(p),
            dirName: path.dirname(p),
            extName: path.extname(p)
        };
    }

    public async resetDb() {
        await clearDB();
        app.relaunch();
        app.quit();
    }

    public async openFolder(p: string) {
        const folder = path.dirname(p);
        await shell.openPath(folder);
    }

    public async changeWindowSize(state: WindowState) {
        SystemService.changeWindowSize(state);
    }

    public async windowState(): Promise<WindowState> {
        return SystemService.windowState();
    }

    public async checkUpdate(): Promise<Release[]> {
        return checkUpdate();
    }

    public async openUrl(url: string) {
        await shell.openExternal(url);
    }

    public async appVersion() {
        return app.getVersion();
    }

    public async openCacheDir() {
        await shell.openPath(BASE_PATH);
    }


    public registerRoutes(): void {
        registerRoute('system/info', this.info);
        registerRoute('system/select-file', this.selectFile);
        registerRoute('system/select-folder', this.selectFolder);
        registerRoute('system/path-info', this.pathInfo);
        registerRoute('system/reset-db', this.resetDb);
        registerRoute('system/open-folder', this.openFolder);
        registerRoute('system/open-folder/cache', this.openCacheDir);
        registerRoute('system/window-size/change', this.changeWindowSize);
        registerRoute('system/window-size', this.windowState);
        registerRoute('system/check-update', this.checkUpdate);
        registerRoute('system/open-url', this.openUrl);
        registerRoute('system/app-version', this.appVersion);
    }
}
