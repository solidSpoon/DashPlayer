import WhisperService from '@/backend/services/WhisperService';
import DpTaskService from '@/backend/services/DpTaskService';

/**
 * AI 翻译
 * @param str
 */
export default class DpTaskController {
    public static async detail(id: number) {
        return DpTaskService.detail(id);
    }

    public static async cancel(id: number) {
        DpTaskService.cancel(id);
    }
}
