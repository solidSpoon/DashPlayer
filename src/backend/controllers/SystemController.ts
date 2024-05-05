import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import {app, dialog, shell} from 'electron';
import {ACCEPTED_FILE_TYPES} from '@/common/utils/MediaUtil';
import path from 'path';
import {clearDB} from "@/backend/db/db";
import {WindowState} from "@/common/types/Types";
import SystemService from "@/backend/services/SystemService";
import {checkUpdate} from "@/backend/services/CheckUpdate";
import Release from "@/common/types/release";
import {BASE_PATH} from "@/backend/controllers/StorageController";

export default class SystemController implements Controller {
    public async isWindows() {
        return process.platform === 'win32';
    }

    public async selectFile({mode}: {
        mode: 'file' | 'directory',
        filter: 'video' | 'srt' | 'none'
    }): Promise<string[]> {
        if (mode === 'file') {
            const files = await dialog.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    {
                        name: 'Movies',
                        extensions: ACCEPTED_FILE_TYPES.split(',').map((item) =>
                            item.substring(1)
                        )
                    }
                ]
            });
            return files.filePaths;
        }
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
        app.quit()
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
        registerRoute('system/is-windows', this.isWindows);
        registerRoute('system/select-file', this.selectFile);
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
