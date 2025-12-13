import { WindowState } from '@/common/types/Types';
import { BrowserWindow } from 'electron';
import {DpTask} from "@/backend/db/tables/dpTask";
import { RendererApiDefinitions } from '@/common/api/renderer-api-def';

/**
 * SystemService
 */
export default interface SystemService {

    changeWindowSize(state: WindowState): void;

    windowState(): WindowState;

    isWindows(): boolean;

    sendErrorToRenderer(error: Error): void;

    sendInfoToRenderer(info: string): void;

    mainWindow(): Electron.BrowserWindow;

    setMainWindow(mainWindowRef: { current: BrowserWindow | null }): void;

    setWindowButtonsVisible(visible: boolean): void;
    /**
     * @description 向渲染进程发送 DpTask 的更新信息。
     * @param task 更新后的任务对象
     */
    sendDpTaskUpdate(task: DpTask): void;

    /**
     * 调用前端API - 使用key作为第一个参数
     */
    callRendererApi<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params']
    ): Promise<RendererApiDefinitions[K]['return']>;

}
