import { injectable, postConstruct } from 'inversify';
import dpLog from '@/backend/ioc/logger';


@injectable()
export class ScheduleServiceImpl {
    @postConstruct()
    init() {
        dpLog.info('ScheduleServiceImpl init');
    }
}
