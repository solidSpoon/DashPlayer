import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsServiceImpl';

export interface ScheduleService {
    init(): void;
}

@injectable()
export class ScheduleServiceImpl implements ScheduleService {
    @inject(TYPES.FavouriteClips) private favouriteClipsService: FavouriteClipsService;

    private FavouriteTask() {
        const func = async () => {
            await this.favouriteClipsService.checkQueue();
            setTimeout(func, 3000);
        };
        func().then();
    }

    init() {
        this.FavouriteTask();
    }
}
