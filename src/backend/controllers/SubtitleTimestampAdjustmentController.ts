// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import SubtitleTimestampAdjustmentService from '../services/SubtitleTimestampAdjustmentService';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
} from '@/backend/db/tables/subtitleTimestampAdjustment';

/**
 * AI 翻译
 * @param str
 */
export default class SubtitleTimestampAdjustmentController {
    public static async getByKey(
        key: string
    ): Promise<SubtitleTimestampAdjustment | undefined> {
        return SubtitleTimestampAdjustmentService.getByKey(key);
    }

    public static async getByPath(
        subtitlePath: string
    ): Promise<SubtitleTimestampAdjustment[]> {
        return SubtitleTimestampAdjustmentService.getByPath(subtitlePath);
    }

    public static async record(
        e: InsertSubtitleTimestampAdjustment
    ): Promise<void> {
        await SubtitleTimestampAdjustmentService.record(e);
    }

    public static async deleteByKey(key: string): Promise<void> {
        await SubtitleTimestampAdjustmentService.deleteByKey(key);
    }

    public static async deleteByPath(subtitlePath: string): Promise<void> {
        await SubtitleTimestampAdjustmentService.deleteByPath(subtitlePath);
    }
}
