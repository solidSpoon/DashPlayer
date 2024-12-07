import log from "electron-log/main";
import path from "path";
import LocationServiceImpl from '@/backend/services/impl/LocationServiceImpl';
import { LocationType } from '@/backend/services/LocationService';
import LocationUtil from '@/backend/utils/LocationUtil';


log.initialize({ preload: true });


const logPath = LocationUtil.staticGetStoragePath(LocationType.LOGS);

log.transports.file.level = "info";
log.transports.file.resolvePathFn = () =>
    path.join(logPath, "main.log");
log.errorHandler.startCatching();
const dpLog = log;

export default dpLog;
