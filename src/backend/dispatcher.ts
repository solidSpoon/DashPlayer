import Controller from '@/backend/interfaces/controller';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { ScheduleService } from '@/backend/services/ScheduleServiceImpl';

export default function registerHandler() {
    const controllerBeans = container.getAll<Controller>(TYPES.Controller);
    controllerBeans.forEach((bean) => {
        bean.registerRoutes();
    });
    const schedule = container.get<ScheduleService>(TYPES.ScheduleService);
    schedule.init();
}
