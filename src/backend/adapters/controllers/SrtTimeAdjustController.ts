import {InsertSubtitleTimestampAdjustment} from '@/backend/infrastructure/db/tables/subtitleTimestampAdjustment';
import registerRoute from '@/backend/adapters/ipc/registerRoute';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';

/**
 * 调整字幕时间
 */
@injectable()
export default class SrtTimeAdjustController implements Controller {
    @inject(TYPES.SrtTimeAdjustService)
    private srtTimeAdjustService!: SrtTimeAdjustService;

    /**
     * 记录调整时间
     * @param e
     */
    public async record(e: InsertSubtitleTimestampAdjustment): Promise<void> {
        await this.srtTimeAdjustService.record(e);
    }

    /**
     * 删除调整时间
     * @param key
     */
    public async deleteByKey(key: string): Promise<void> {
        await this.srtTimeAdjustService.deleteByKey(key);
    }

    /**
     * 删除调整时间
     * @param fileHash
     */
    public async deleteByFile(fileHash: string): Promise<void> {
        await this.srtTimeAdjustService.deleteByFile(fileHash);
    }

    registerRoutes(): void {
        registerRoute('subtitle-timestamp/delete/by-file-hash', (p) => this.deleteByFile(p));
        registerRoute('subtitle-timestamp/delete/by-key', (p) => this.deleteByKey(p));
        registerRoute('subtitle-timestamp/update', (p) => this.record(p));
    }
}
