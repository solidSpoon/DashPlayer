/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
import { startRendererRuntime } from './fronted/app/bootstrap/rendererRuntime';
import { mountApp } from './app';
import { getRendererLogger } from './fronted/log/simple-logger';

const rendererStartupStartedAt = performance.now();
const rendererLogger = getRendererLogger('RendererStartup');

// 初始化 renderer 运行时（IPC、设置同步、任务监听等）。
const stopRendererRuntime = startRendererRuntime();
window.addEventListener('beforeunload', stopRendererRuntime, { once: true });
rendererLogger.info('renderer runtime startup completed', {
    durationMs: Math.round(performance.now() - rendererStartupStartedAt),
});

// 基础运行时就绪后再挂载 React 应用。
mountApp();
rendererLogger.info('renderer first mount completed', {
    durationMs: Math.round(performance.now() - rendererStartupStartedAt),
});
