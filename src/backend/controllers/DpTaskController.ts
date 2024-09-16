import DpTaskService from '@/backend/services/DpTaskService';
import registerRoute from '@/common/api/register';
import { DpTask } from '@/backend/db/tables/dpTask';
import Controller from '@/backend/interfaces/controller';
import { injectable } from 'inversify';

/**
 * AI 翻译
 * @param str
 */
@injectable()
export default class DpTaskController implements Controller {
    public async detail(id: number) {
        return DpTaskService.detail(id);
    }

    public async details(ids: number[]): Promise<Map<number, DpTask>> {
        return DpTaskService.details(ids);
    }

    public async cancel(id: number) {
        DpTaskService.cancel(id);
    }

    registerRoutes(): void {
        registerRoute('dp-task/detail', (p) => this.detail(p));
        registerRoute('dp-task/cancel', (p) => this.cancel(p));
        registerRoute('dp-task/details', (p) => this.details(p));
    }

}
