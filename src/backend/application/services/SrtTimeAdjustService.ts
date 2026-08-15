import {
    SubtitleTimestampAdjustment,
    SubtitleTimestampAdjustmentInput,
} from '@/common/contracts/subtitle-timestamp-adjustment';
import { inject, injectable } from 'inversify';

import SubtitleTimestampAdjustmentsRepository
    from '@/backend/application/ports/repositories/SubtitleTimestampAdjustmentsRepository';
import TYPES from '@/backend/ioc/types';

/**
 * 管理字幕时间调整记录。
 */
@injectable()
export default class SrtTimeAdjustService {
    @inject(TYPES.SubtitleTimestampAdjustmentsRepository)
    private subtitleTimestampAdjustmentsRepository!: SubtitleTimestampAdjustmentsRepository;

    /**
     * 新增或覆盖一条字幕时间调整记录。
     *
     * @param adjustment 待保存的调整记录。
     */
    public async record(adjustment: SubtitleTimestampAdjustmentInput): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.upsert(adjustment);
    }

    /**
     * 按记录键删除字幕时间调整。
     *
     * @param key 调整记录键。
     */
    public async deleteByKey(key: string): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.deleteByKey(key);
    }

    /**
     * 删除指定文件的全部字幕时间调整。
     *
     * @param fileHash 文件哈希。
     */
    public async deleteByFile(fileHash: string): Promise<void> {
        await this.subtitleTimestampAdjustmentsRepository.deleteByFileHash(fileHash);
    }

    /**
     * 按记录键读取字幕时间调整。
     *
     * @param key 调整记录键。
     * @returns 对应记录；不存在时返回 `undefined`。
     */
    public async getByKey(key: string): Promise<SubtitleTimestampAdjustment | undefined> {
        return this.subtitleTimestampAdjustmentsRepository.findByKey(key);
    }

    /**
     * 按字幕路径读取全部时间调整。
     *
     * @param subtitlePath 字幕文件路径。
     * @returns 对应的调整记录列表。
     */
    public getByPath(subtitlePath: string): Promise<SubtitleTimestampAdjustment[]> {
        return this.subtitleTimestampAdjustmentsRepository.findByPath(subtitlePath);
    }

    /**
     * 按文件哈希读取全部时间调整。
     *
     * @param hash 文件哈希。
     * @returns 对应的调整记录列表。
     */
    public getByHash(hash: string): Promise<SubtitleTimestampAdjustment[]> {
        return this.subtitleTimestampAdjustmentsRepository.findByHash(hash);
    }
}
