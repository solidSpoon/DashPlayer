import { WindowState } from '@/common/types/Types';
import { BrowserWindow } from 'electron';
import {DpTask} from "@/backend/db/tables/dpTask";

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
    /**
     * @description 向渲染进程发送 DpTask 的更新信息。
     * @param task 更新后的任务对象
     */
    sendDpTaskUpdate(task: DpTask): void;
}
