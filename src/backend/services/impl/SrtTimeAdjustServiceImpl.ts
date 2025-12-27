import {
    InsertSubtitleTimestampAdjustment,
    SubtitleTimestampAdjustment
} from '@/backend/db/tables/subtitleTimestampAdjustment';
import { inject, injectable } from 'inversify';
import SrtTimeAdjustService from '@/backend/services/SrtTimeAdjustService';
import TYPES from '@/backend/ioc/types';
import SubtitleTimestampAdjustmentsRepository from '@/backend/db/repositories/SubtitleTimestampAdjustmentsRepository';

@injectable()
export default class SrtTimeAdjustServiceImpl implements SrtTimeAdjustService {

    @inject(TYPES.SubtitleTimestampAdjustmentsRepository)
    private subtitleTimestampAdjustmentsRepository!: SubtitleTimestampAdjustmentsRepository;

    public async record(e: InsertSubtitleTimestampAdjustment): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.upsert(e);
    }

    public async deleteByKey(key: string): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.deleteByKey(key);
    }

    public async deleteByFile(fileHash: string): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.deleteByFileHash(fileHash);
    }

    public async getByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined> {
        return this.subtitleTimestampAdjustmentsRepository.findByKey(key);
    }

    public getByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]> {
        return this.subtitleTimestampAdjustmentsRepository.findByPath(subtitlePath);
    }

    public getByHash(h: string): Promise<SubtitleTimestampAdjustment[]> {
        return this.subtitleTimestampAdjustmentsRepository.findByHash(h.toString());
    }
}
