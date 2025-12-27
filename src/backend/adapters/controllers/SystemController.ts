import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { app, dialog, shell } from 'electron';
import path from 'path';
import { clearDB } from '@/backend/infrastructure/db/db';
import { WindowState } from '@/common/types/Types';
import { checkUpdate } from '@/backend/application/services/CheckUpdate';
import Release from '@/common/types/release';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import StrUtil from '@/common/utils/str-util';
import TYPES from '@/backend/ioc/types';
import OpenDialogOptions = Electron.OpenDialogOptions;
import LocationService from '@/backend/application/services/LocationService';
import WindowPort from '@/backend/application/ports/gateways/window/WindowPort';

/**
 * eg: .mkv -> mkv
 * @param filter
 */
function processFilter(filter: string[]) {
    return filter
        .filter(f => StrUtil.isNotBlank(f))
        .map(f => f.replace(/^\./, ''));
}

@injectable()
export default class SystemController implements Controller {
    @inject(TYPES.WindowPort)
    private windowPort!: WindowPort;
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    public async info() {
        const platform = process.platform;
        return {
            isWindows: platform === 'win32',
            isMac: platform === 'darwin',
            isLinux: platform === 'linux',
            pathSeparator: path.sep,
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

    public async selectFolder({ defaultPath , createDirectory}: { defaultPath?: string,createDirectory?:boolean }): Promise<string[]> {
        const options: OpenDialogOptions = {
            properties: ['openDirectory']
        };
        if (defaultPath) {
            options.defaultPath = defaultPath;
        }
        if (createDirectory) {
            options.properties?.push('createDirectory');
        }
        const files = await dialog.showOpenDialog(options);
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

    public async setWindowButtonsVisible(visible: boolean) {
        this.windowPort.setWindowButtonsVisible(visible);
    }

    public async changeWindowSize(state: WindowState) {
        this.windowPort.changeWindowSize(state);
    }

    public async windowState(): Promise<WindowState> {
        return this.windowPort.windowState();
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
        await shell.openPath(this.locationService.getBaseLibraryPath());
    }

    public registerRoutes(): void {
        registerRoute('system/info', (_) => this.info());
        registerRoute('system/select-file', (p) => this.selectFile(p));
        registerRoute('system/select-folder', (p) => this.selectFolder(p));
        registerRoute('system/path-info', (p) => this.pathInfo(p));
        registerRoute('system/reset-db', (_) => this.resetDb());
        registerRoute('system/open-folder', (p) => this.openFolder(p));
        registerRoute('system/open-folder/cache', (p) => this.openCacheDir());
        registerRoute('system/window-size/change', (p) => this.changeWindowSize(p));
        registerRoute('system/window-size', (p) => this.windowState());
        registerRoute('system/window-buttons/visibility', (p) => this.setWindowButtonsVisible(p));
        registerRoute('system/check-update', (p) => this.checkUpdate());
        registerRoute('system/open-url', (p) => this.openUrl(p));
        registerRoute('system/app-version', (p) => this.appVersion());
    }
}
