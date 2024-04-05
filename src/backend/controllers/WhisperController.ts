import WhisperService from '@/backend/services/WhisperService';
import DpTaskService from '@/backend/services/DpTaskService';

/**
 * AI 翻译
 * @param str
 */
export default class WhisperController {
    public static async transcript(filePath: string) {
        const taskId = await DpTaskService.create();
        console.log('taskId', taskId);
        WhisperService.transcript(taskId, filePath).then(r => {
            console.log(r);
        });
        return taskId;
    }
}
