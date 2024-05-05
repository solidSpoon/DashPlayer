import DpTaskService from '@/backend/services/DpTaskService';
import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import {DpTask} from "@/backend/db/tables/dpTask";

/**
 * AI 翻译
 * @param str
 */
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
        registerRoute('dp-task/detail', this.detail);
        registerRoute('dp-task/cancel', this.cancel);
        registerRoute('dp-task/details', this.details);
    }

}
