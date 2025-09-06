/**
 * 前端Controllers初始化脚本
 * 在前端应用启动时调用这个函数
 */

import { initRendererControllers } from './controllers/ControllerManager';
import { getRendererLogger } from './log/simple-logger';

// 在DOM加载完成后初始化Controllers
function initializeRendererControllers() {
    const logger = getRendererLogger('InitControllers');
    logger.info('initializing frontend controllers...');
    
    try {
        const cleanup = initRendererControllers();
        
        // 将清理函数挂载到window对象，方便调试
        (window as any).cleanupRendererControllers = cleanup;
        
        logger.info('frontend controllers initialized successfully');
        logger.debug('test command available: await window.electron.call("system/test-renderer-api")');
        
    } catch (error) {
        logger.error('frontend controllers initialization failed', { error: error?.message || error });
    }
}

// 自动初始化
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRendererControllers);
    } else {
        initializeRendererControllers();
    }
}

export { initializeRendererControllers };