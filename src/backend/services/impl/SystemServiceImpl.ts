import { WindowState } from '@/common/types/Types';
import { injectable, postConstruct } from 'inversify';
import SystemService from '@/backend/services/SystemService';
import { BrowserWindow, ipcMain, app } from 'electron';
import PathUtil from '@/common/utils/PathUtil';
import path from 'path';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import {DpTask} from "@/backend/db/tables/dpTask";
import { RendererApiDefinitions } from '@/common/api/renderer-api-def';
import * as fs from 'fs/promises';
import LocationUtil from '@/backend/utils/LocationUtil';
import { LocationType } from '@/backend/services/LocationService';
import { getMainLogger } from '@/backend/ioc/simple-logger';
@injectable()
export default class SystemServiceImpl implements SystemService {
    public mainWindowRef: { current: BrowserWindow | null } = { current: null };
    public static MAIN_WINDOWS_REF : { current: BrowserWindow | null } = { current: null };
    private callIdCounter = 0;
    private logger = getMainLogger('SystemServiceImpl');

    public mainWindow() {
        const current = this.mainWindowRef.current;
        TypeGuards.assertNotNull(current, 'mainWindow is null');
        return current;
    }

    public setMainWindow(mainWindowRef: { current: BrowserWindow | null }) {
        this.mainWindowRef = mainWindowRef;
        SystemServiceImpl.MAIN_WINDOWS_REF = mainWindowRef;
    }

    public changeWindowSize(state: WindowState) {
        switch (state) {
            case 'normal':
                this.mainWindow()?.unmaximize();
                this.mainWindow()?.setFullScreen(false);
                break;
            case 'maximized':
                this.mainWindow()?.maximize();
                break;
            case 'minimized':
                this.mainWindow()?.minimize();
                break;
            case 'fullscreen':
                this.mainWindow()?.setFullScreen(true);
                break;
            case 'closed':
                this.mainWindow()?.close();
                break;
            case 'home':
                this.mainWindow()?.unmaximize();
                this.mainWindow()?.setSize(1200, 800);
                this.mainWindow()?.setResizable(false);
                this.mainWindow()?.setMaximizable(false);
                break;
            case 'player':
                this.mainWindow()?.setResizable(true);
                this.mainWindow()?.setMaximizable(true);
                this.mainWindow()?.maximize();
                break;
            default:
                break;
        }
    }

    public windowState(): WindowState {
        if (this.mainWindow().isMaximized()) {
            return 'maximized';
        } else if (this.mainWindow().isMinimized()) {
            return 'minimized';
        } else if (this.mainWindow().isFullScreen()) {
            return 'fullscreen';
        } else {
            return 'normal';
        }
    }

    public isWindows() {
        return process.platform === 'win32';
    }

    public sendErrorToRenderer(error: Error) {
        this.mainWindow()?.webContents.send('error-msg', error);
    }

    public sendInfoToRenderer(info: string) {
        this.mainWindow()?.webContents.send('info-msg', info);
    }

    /**
     * (新增) 实现发送任务更新的逻辑
     */
    public sendDpTaskUpdate(task: DpTask): void {
        const win = this.mainWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('dp-task-update', task);
        }
    }

    /**
     * 调用前端API - 使用key作为第一个参数
     */
    public async callRendererApi<K extends keyof RendererApiDefinitions>(
        path: K,
        params: RendererApiDefinitions[K]['params']
    ): Promise<RendererApiDefinitions[K]['return']> {
        const mainWindow = this.mainWindowRef.current;
        if (!mainWindow || mainWindow.isDestroyed()) {
            throw new Error('Main window is not available');
        }

        const callId = `${path}-${++this.callIdCounter}-${Date.now()}`;

        return new Promise<RendererApiDefinitions[K]['return']>((resolve, reject) => {
            // 添加一次性响应监听器
            const eventName = `renderer-api-response-${callId}`;
            
            ipcMain.once(eventName, (event: any, response: any) => {
                if (response.success) {
                    resolve(response.result);
                } else {
                    reject(new Error(response.error || 'Unknown error'));
                }
            });

            // 发送调用请求到前端
            mainWindow.webContents.send(`renderer-api-call-${path}`, callId, params);
        });
    }

    /**
     * 测试反向API调用 - 显示通知
     */
    public async testRendererApiCall(): Promise<void> {
        this.logger.info('Testing frontend API call');
        
        try {
            // 调用前端显示通知
            await this.callRendererApi('ui/show-notification', {
                title: '后端调用测试',
                message: '这是从后端SystemService发送的通知！',
                type: 'info'
            });
            this.logger.info('Notification sent successfully');
            
            // 调用前端显示Toast
            await this.callRendererApi('ui/show-toast', {
                message: '反向API调用成功！',
                duration: 3000
            });
            this.logger.info('Toast sent successfully');

            // 测试翻译功能 - 模拟翻译结果回传
            this.logger.info('Testing translation functionality');
            
            setTimeout(async () => {
                await this.callRendererApi('translation/result', {
                    key: 'test-translation-key-1',
                    translation: '这是一个测试翻译结果'
                });
                this.logger.info('Translation result sent successfully');
            }, 1000);

            setTimeout(async () => {
                await this.callRendererApi('translation/batch-result', {
                    translations: [
                        { key: 'test-key-1', translation: '你好世界' },
                        { key: 'test-key-2', translation: '这是第二个测试' },
                        { key: 'test-key-3', translation: '批量翻译测试' }
                    ]
                });
                this.logger.info('Batch translation result sent successfully');
            }, 2000);
            
        } catch (error) {
            this.logger.error('Reverse API call failed', { error: error instanceof Error ? error.message : String(error) });
        }
    }

    public async isParakeetModelDownloaded(): Promise<boolean> {
        const modelDir = path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'whisper-asr');
        const modelFile = path.join(modelDir, 'ggml-base.bin');
        const binaryFile = path.join(modelDir, process.platform === 'win32' ? 'whisper.exe' : (process.platform === 'darwin' ? 'whisper-cli' : 'whisper'));
        
        try {
            return await fs.access(modelFile).then(() => true) &&
                   await fs.access(binaryFile).then(() => true);
        } catch {
            return false;
        }
    }

    @postConstruct()
    init() {
        PathUtil.SEPARATOR = path.sep;
    }
}
