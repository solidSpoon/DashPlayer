import { Container } from 'inversify';
import TYPES from './types';
import LocalOssService, { OssService } from '@/backend/services/LocalOssService';
import { MetaData, OssObject } from '@/common/types/OssObject';
import { ScheduleService, ScheduleServiceImpl } from '@/backend/services/ScheduleServiceImpl';
import FavouriteClipsServiceImpl, { FavouriteClipsService } from '@/backend/services/FavouriteClipsServiceImpl';
import FavoriteClipsController from '@/backend/controllers/FavoriteClipsController';
import ControllerT from '@/backend/interfaces/controllerT';
import WatchProjectController from '@/backend/controllers/WatchProjectController';
import WatchProjectServiceImpl, { WatchProjectService } from '@/backend/services/WatchProjectServiceImpl';
import DownloadVideoController from '@/backend/controllers/DownloadVideoController';
import DlVideoServiceImpl, { DlVideoService } from '@/backend/services/DlVideoServiceImpl';

const container = new Container();

// Controllers
container.bind<ControllerT>(TYPES.Controller).to(FavoriteClipsController).inSingletonScope();
container.bind<ControllerT>(TYPES.Controller).to(WatchProjectController).inSingletonScope();
container.bind<ControllerT>(TYPES.Controller).to(DownloadVideoController).inSingletonScope();
// Services
container.bind<OssService<MetaData, OssObject>>(TYPES.LocalOss).to(LocalOssService).inSingletonScope();
container.bind<ScheduleService>(TYPES.ScheduleService).to(ScheduleServiceImpl).inSingletonScope();
container.bind<FavouriteClipsService>(TYPES.FavouriteClips).to(FavouriteClipsServiceImpl).inSingletonScope();
container.bind<WatchProjectService>(TYPES.WatchProject).to(WatchProjectServiceImpl).inSingletonScope();
container.bind<DlVideoService>(TYPES.DlVideo).to(DlVideoServiceImpl).inSingletonScope();


export default container;
