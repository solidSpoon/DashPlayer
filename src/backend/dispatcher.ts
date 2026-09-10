import Controller from '@/backend/controllers/Controller';
import MigrationFailureController from '@/backend/controllers/MigrationFailureController';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import MainWindowRegistry from '@/backend/infrastructure/system/MainWindowRegistry';
import { BrowserWindow } from 'electron';

/**
 * 注册 IPC 处理器。
 *
 * 迁移失败恢复路由（migration-failure/*）两种模式下都注册：正常模式下它
 * 返回 failed=false，供前端确认可以进入主界面。
 *
 * @param mainWindowRef 主窗口引用。
 * @param options.recoveryMode 恢复模式（启动迁移失败）：只注册恢复路由，
 * 不解析业务控制器——它们依赖数据库与完整服务容器，恢复模式下不可用。
 */
export default function registerHandler(mainWindowRef: { current: BrowserWindow | null }, options: { recoveryMode?: boolean } = {}) {
    container.get<MigrationFailureController>(TYPES.MigrationFailureController).registerRoutes();
    if (!options.recoveryMode) {
        const controllerBeans = container.getAll<Controller>(TYPES.Controller);
        controllerBeans.forEach((bean) => {
            bean.registerRoutes();
        });
    }
    container.get<MainWindowRegistry>(TYPES.MainWindowRegistry).setMainWindowRef(mainWindowRef);
}
