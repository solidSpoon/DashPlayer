import DlVideoServiceImpl from '@/backend/services/DlVideoServiceImpl';

const TYPES = {
    LocalOss: Symbol('LocalOss'),
    FavouriteClips: Symbol('FavouriteClips'),
    ScheduleService: Symbol('ScheduleService'),
    Controller: Symbol('Controller'),
    WatchProject: Symbol('WatchProject'),
    DlVideo: Symbol('DlVideo'),
    TagService: Symbol('TagService'),
};

export default TYPES;
