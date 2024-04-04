// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import SubtitleTimestampAdjustmentService from '../services/SubtitleTimestampAdjustmentService';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
} from '@/backend/db/tables/subtitleTimestampAdjustment';
// import WhisperService from '@/backend/services/WhisperService';

/**
 * AI 翻译
 * @param str
 */
export default class WhisperController {
    public static async transcript(filePaths: string[]) {
        // const string = filePaths[0];
        // return WhisperService.transcript(string);
    }
}
