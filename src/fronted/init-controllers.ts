/**
 * 前端 Renderer APIs 初始化脚本
 * 在前端应用启动时调用这个函数
 */

import { initRendererApis } from './application/bootstrap/initRendererApis';
import { getRendererLogger } from './log/simple-logger';

function initializeRendererApis() {
    const logger = getRendererLogger('InitRendererApis');
    logger.info('initializing renderer apis...');
    
    try {
        const cleanup = initRendererApis();
        
        // 将清理函数挂载到window对象，方便调试
        (window as any).cleanupRendererApis = cleanup;
        
        logger.info('renderer apis initialized successfully');
        logger.debug('test command available: await window.electron.call("system/test-renderer-api")');
        
    } catch (error) {
        logger.error('renderer apis initialization failed', { error: error instanceof Error ? error.message : String(error) });
    }
}

// 自动初始化
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeRendererApis);
    } else {
        initializeRendererApis();
    }
}

export { initializeRendererApis };
