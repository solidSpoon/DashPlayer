/**
 * 前端Controllers初始化脚本
 * 在前端应用启动时调用这个函数
 */

import { initRendererControllers } from './controllers/ControllerManager';

// 在DOM加载完成后初始化Controllers
function initializeRendererControllers() {
    console.log('正在初始化前端Controllers...');
    
    try {
        const cleanup = initRendererControllers();
        
        // 将清理函数挂载到window对象，方便调试
        (window as any).cleanupRendererControllers = cleanup;
        
        console.log('✅ 前端Controllers初始化成功');
        console.log('可以在控制台执行以下命令测试：');
        console.log('await window.electron.call("system/test-renderer-api")');
        
    } catch (error) {
        console.error('❌ 前端Controllers初始化失败:', error);
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