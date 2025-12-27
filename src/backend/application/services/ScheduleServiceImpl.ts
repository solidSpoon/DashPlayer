import { injectable, postConstruct } from 'inversify';
import dpLog from '@/backend/infrastructure/logger';


@injectable()
export class ScheduleServiceImpl {
    @postConstruct()
    init() {
        dpLog.info('ScheduleServiceImpl init');
    }
}
