/**
 * 前端Controller管理器
 * 集中管理所有前端Controller的注册和生命周期
 */

import RendererController, { ControllerRegistry } from '@/fronted/interfaces/RendererController';
import { UIController } from './UIController';
import { TranslationController } from './TranslationController';
import { TranscriptionController } from './TranscriptionController';
import { getRendererLogger } from '@/fronted/log/simple-logger';

class ControllerManager {
    private controllers: ControllerRegistry[] = [];
    private logger = getRendererLogger('ControllerManager');

    /**
     * 注册单个Controller
     */
    registerController(controller: RendererController): void {
        const unregister = controller.registerApis();
        
        this.controllers.push({
            name: controller.name,
            controller,
            unregister
        });

        this.logger.info('Controller registered', { name: controller.name });
    }

    /**
     * 注册所有Controller
     */
    registerAllControllers(): void {
        this.logger.info('Registering all frontend controllers');
        
        // 在这里添加所有Controller
        this.registerController(new UIController());
        this.registerController(new TranslationController());
        this.registerController(new TranscriptionController());
        
        this.logger.info('Controllers registered', { count: this.controllers.length });
    }

    /**
     * 注销所有Controller
     */
    unregisterAllControllers(): void {
        this.logger.info('Unregistering all frontend controllers');
        
        this.controllers.forEach(({ name, unregister }) => {
            try {
                unregister();
                this.logger.info('Controller unregistered', { name });
            } catch (error) {
                this.logger.error('Failed to unregister controller', { name, error: error instanceof Error ? error.message : String(error) });
            }
        });

        this.controllers = [];
    }

    /**
     * 获取已注册的Controller列表
     */
    getRegisteredControllers(): string[] {
        return this.controllers.map(c => c.name);
    }
}

// 创建单例实例
export const controllerManager = new ControllerManager();

/**
 * 初始化前端Controllers
 * 在应用启动时调用
 */
export function initRendererControllers(): () => void {
    controllerManager.registerAllControllers();
    
    // 返回清理函数
    return () => {
        controllerManager.unregisterAllControllers();
    };
}