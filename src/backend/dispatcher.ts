import Controller from '@/backend/interfaces/controller';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import SystemService from '@/backend/application/services/SystemService';
import { BrowserWindow } from 'electron';

export default function registerHandler(mainWindowRef: { current: BrowserWindow | null }) {
    const controllerBeans = container.getAll<Controller>(TYPES.Controller);
    controllerBeans.forEach((bean) => {
        bean.registerRoutes();
    });
    container.get<SystemService>(TYPES.SystemService).setMainWindow(mainWindowRef);
}
