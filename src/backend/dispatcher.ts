import StorageController from './controllers/StorageController';
import SubtitleTimestampAdjustmentController from '@/backend/controllers/SubtitleTimestampAdjustmentController';
import ControllerT from "@/backend/interfaces/controllerT";
import AiFuncController from "@/backend/controllers/AiFuncController";
import SystemController from "@/backend/controllers/SystemController";
import DpTaskController from "@/backend/controllers/DpTaskController";
import AiTransController from "@/backend/controllers/AiTransController";
import SubtitleController from '@/backend/controllers/SubtitleController';
import MediaController from "@/backend/controllers/MediaController";
import ConvertController from "@/backend/controllers/ConvertController";
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/interfaces/controller';
import { ScheduleService } from '@/backend/services/ScheduleServiceImpl';


const controllers: Controller[] = [
    new AiFuncController(),
    new SystemController(),
    new DpTaskController(),
    new AiTransController(),
    new SubtitleController(),
    new MediaController(),
    new SubtitleTimestampAdjustmentController(),
    new StorageController(),
    new ConvertController(),
]

export default function registerHandler() {
    const controllerBeans = container.getAll<ControllerT>(TYPES.Controller);
    controllerBeans.forEach((bean) => {
        bean.registerRoutes();
    })
    controllers.forEach((controller) => {
        controller.registerRoutes();
    });
    const schedule = container.get<ScheduleService>(TYPES.ScheduleService);
    schedule.init();
}
