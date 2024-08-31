import StorageController from './controllers/StorageController';
import SubtitleTimestampAdjustmentController from '@/backend/controllers/SubtitleTimestampAdjustmentController';
import Controller from "@/backend/interfaces/controller";
import AiFuncController from "@/backend/controllers/AiFuncController";
import SystemController from "@/backend/controllers/SystemController";
import DpTaskController from "@/backend/controllers/DpTaskController";
import AiTransController from "@/backend/controllers/AiTransController";
import WatchProjectController from '@/backend/controllers/WatchProjectController';
import SubtitleController from '@/backend/controllers/SubtitleController';
import MediaController from "@/backend/controllers/MediaController";
import DownloadVideoController from "@/backend/controllers/DownloadVideoController";
import ConvertController from "@/backend/controllers/ConvertController";
import FavoriteClipsController from '@/backend/controllers/FavoriteClipsController';


const controllers: Controller[] = [
    new AiFuncController(),
    new SystemController(),
    new DpTaskController(),
    new AiTransController(),
    new WatchProjectController(),
    new SubtitleController(),
    new MediaController(),
    new SubtitleTimestampAdjustmentController(),
    new StorageController(),
    new DownloadVideoController(),
    new ConvertController(),
    new FavoriteClipsController(),
]

export default function registerHandler() {
    controllers.forEach((controller) => {
        controller.registerRoutes();
    });
}
