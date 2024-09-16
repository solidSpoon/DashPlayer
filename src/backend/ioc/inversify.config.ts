import { Container } from 'inversify';
import TYPES from './types';
import LocalOssService, { OssService } from '@/backend/services/LocalOssService';
import { MetaData, OssObject } from '@/common/types/OssObject';
import { ScheduleService, ScheduleServiceImpl } from '@/backend/services/ScheduleServiceImpl';
import FavouriteClipsServiceImpl, { FavouriteClipsService } from '@/backend/services/FavouriteClipsServiceImpl';
import FavoriteClipsController from '@/backend/controllers/FavoriteClipsController';
import Controller from '@/backend/interfaces/controller';
import WatchProjectController from '@/backend/controllers/WatchProjectController';
import WatchProjectServiceImpl, { WatchProjectService } from '@/backend/services/WatchProjectServiceImpl';
import DownloadVideoController from '@/backend/controllers/DownloadVideoController';
import DlVideoServiceImpl, { DlVideoService } from '@/backend/services/DlVideoServiceImpl';
import TagServiceImpl, { TagService } from '@/backend/services/TagService';
import TagController from '@/backend/controllers/TagController';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';
import { SubtitleServiceImpl } from '@/backend/services/impl/SubtitleServiceImpl';
import SubtitleService from '@/backend/services/SubtitleService';
import SrtTimeAdjustServiceImpl from '@/backend/services/impl/SrtTimeAdjustServiceImpl';
import SrtTimeAdjustController from '@/backend/controllers/SrtTimeAdjustController';
import AiFuncController from '@/backend/controllers/AiFuncController';
import AiTransController from '@/backend/controllers/AiTransController';
import ConvertController from '@/backend/controllers/ConvertController';
import DpTaskController from '@/backend/controllers/DpTaskController';
import MediaController from '@/backend/controllers/MediaController';
import StorageController from '@/backend/controllers/StorageController';
import SystemController from '@/backend/controllers/SystemController';
import SubtitleController from '@/backend/controllers/SubtitleController';

const container = new Container();

// Controllers
container.bind<Controller>(TYPES.Controller).to(FavoriteClipsController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(WatchProjectController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(DownloadVideoController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(TagController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(SrtTimeAdjustController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(AiFuncController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(AiTransController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(ConvertController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(DpTaskController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(MediaController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(StorageController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(SystemController).inSingletonScope();
container.bind<Controller>(TYPES.Controller).to(SubtitleController).inSingletonScope();
// Services
container.bind<OssService<MetaData, OssObject>>(TYPES.LocalOss).to(LocalOssService).inSingletonScope();
container.bind<ScheduleService>(TYPES.ScheduleService).to(ScheduleServiceImpl).inSingletonScope();
container.bind<FavouriteClipsService>(TYPES.FavouriteClips).to(FavouriteClipsServiceImpl).inSingletonScope();
container.bind<WatchProjectService>(TYPES.WatchProject).to(WatchProjectServiceImpl).inSingletonScope();
container.bind<DlVideoService>(TYPES.DlVideo).to(DlVideoServiceImpl).inSingletonScope();
container.bind<TagService>(TYPES.TagService).to(TagServiceImpl).inSingletonScope();
container.bind<SrtTimeAdjustService>(TYPES.SrtTimeAdjustService).to(SrtTimeAdjustServiceImpl).inSingletonScope();
container.bind<SubtitleService>(TYPES.SubtitleService).to(SubtitleServiceImpl).inSingletonScope();

export default container;
