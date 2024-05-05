// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import SubtitleTimestampAdjustmentService from '../services/SubtitleTimestampAdjustmentService';
import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment,
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";

/**
 * AI 翻译
 * @param str
 */
export default class SubtitleTimestampAdjustmentController implements Controller{
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

    public async record(
        e: InsertSubtitleTimestampAdjustment
    ): Promise<void> {
        await SubtitleTimestampAdjustmentService.record(e);
    }

    public async deleteByKey(key: string): Promise<void> {
        await SubtitleTimestampAdjustmentService.deleteByKey(key);
    }

    public async deleteByFile(fileHash: string): Promise<void> {
        await SubtitleTimestampAdjustmentService.deleteByFile(fileHash);
    }

    registerRoutes(): void {
        registerRoute('subtitle-timestamp/delete/by-file-hash', this.deleteByFile);
        registerRoute('subtitle-timestamp/delete/by-key', this.deleteByKey);
        registerRoute('subtitle-timestamp/update', this.record);
    }

}
