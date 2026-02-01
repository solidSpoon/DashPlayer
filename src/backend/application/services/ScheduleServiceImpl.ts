import { injectable, postConstruct } from 'inversify';
import { getMainLogger } from '@/backend/infrastructure/logger';


@injectable()
export class ScheduleServiceImpl {
    private readonly logger = getMainLogger('ScheduleServiceImpl');

    @postConstruct()
    init() {
        this.logger.info('ScheduleServiceImpl init');
    }
}
