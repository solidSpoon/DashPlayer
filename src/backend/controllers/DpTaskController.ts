import DpTaskServiceImpl from '@/backend/services/impl/DpTaskServiceImpl';
import registerRoute from '@/common/api/register';
import { DpTask } from '@/backend/db/tables/dpTask';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/services/DpTaskService';
import ChildProcessService from '@/backend/services/ChildProcessService';

/**
 * AI 翻译
 * @param str
 */
@injectable()
export default class DpTaskController implements Controller {
    @inject(TYPES.DpTaskService)
    private dpTaskService: DpTaskService;

    @inject(TYPES.ChildProcessService)
    private childProcessService: ChildProcessService;

    public async detail(id: number) {
        return this.dpTaskService.detail(id);
    }

    public async details(ids: number[]): Promise<Map<number, DpTask>> {
        return this.dpTaskService.details(ids);
    }

    public async cancel(id: number) {
        this.childProcessService.killTask(id);
    }

    registerRoutes(): void {
        registerRoute('dp-task/detail', (p) => this.detail(p));
        registerRoute('dp-task/cancel', (p) => this.cancel(p));
        registerRoute('dp-task/details', (p) => this.details(p));
    }

}
