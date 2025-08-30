/**
 * 前端Controller管理器
 * 集中管理所有前端Controller的注册和生命周期
 */

import RendererController, { ControllerRegistry } from '@/fronted/interfaces/RendererController';
import { UIController } from './UIController';
import { TranslationController } from './TranslationController';

class ControllerManager {
    private controllers: ControllerRegistry[] = [];

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

        console.log(`Controller registered: ${controller.name}`);
    }

    /**
     * 注册所有Controller
     */
    registerAllControllers(): void {
        console.log('注册所有前端Controllers...');
        
        // 在这里添加所有Controller
        this.registerController(new UIController());
        this.registerController(new TranslationController());
        
        console.log(`已注册 ${this.controllers.length} 个Controllers`);
    }

    /**
     * 注销所有Controller
     */
    unregisterAllControllers(): void {
        console.log('注销所有前端Controllers...');
        
        this.controllers.forEach(({ name, unregister }) => {
            try {
                unregister();
                console.log(`Controller unregistered: ${name}`);
            } catch (error) {
                console.error(`Failed to unregister controller ${name}:`, error);
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