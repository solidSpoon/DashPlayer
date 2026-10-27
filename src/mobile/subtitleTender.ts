import type { MobileSubtitleLine } from '@/common/contracts/mobile-web';

/** 时间桶宽度，与桌面端 SrtTender 保持一致。 */
const GROUP_SECONDS = 10;

/**
 * 手机端字幕时间轴索引。
 *
 * 移植桌面端 SrtTender 的查找思路：按 10 秒分桶，缓存上一次命中的下标，
 * 每句的有效范围延伸到下一句开头，句间空隙仍算上一句。字幕时间已经由后端
 * 应用过用户的时间轴调整，这里直接使用 start/end，不再处理 adjusted 字段。
 */
export default class SubtitleTender {
    private readonly lines: MobileSubtitleLine[];
    private readonly buckets = new Map<number, number[]>();
    /** 上一次命中的下标，连续 timeupdate 时可直接复用。 */
    private cacheIndex: number | null = null;
    /** 没有命中任何一句时退回的下标，和桌面端一致。 */
    private backupIndex = 0;

    /**
     * 创建索引并预先分桶。
     *
     * @param lines 已按时间排序的字幕行。
     */
    public constructor(lines: MobileSubtitleLine[]) {
        this.lines = lines;
        for (let index = 0; index < lines.length; index += 1) {
            const minBucket = Math.floor(Math.min(this.start(index), this.nextStart(index)) / GROUP_SECONDS);
            const maxBucket = Math.floor(Math.max(this.end(index), this.nextStart(index)) / GROUP_SECONDS);
            for (let bucket = minBucket; bucket <= maxBucket; bucket += 1) {
                const group = this.buckets.get(bucket) ?? [];
                // 后写入的放前面，与桌面端桶内顺序一致：重叠时优先较晚的那一句。
                group.unshift(index);
                this.buckets.set(bucket, group);
            }
        }
    }

    /**
     * 查找某个时间点对应的字幕下标。
     *
     * @param time 播放时间，单位秒。
     * @returns 字幕下标；字幕列表为空时返回 -1。
     */
    public getIndexByTime(time: number): number {
        if (this.lines.length === 0) {
            return -1;
        }

        if (this.cacheIndex !== null && this.isCurrent(this.cacheIndex, time)) {
            this.backupIndex = this.cacheIndex;
            return this.cacheIndex;
        }

        const bucket = this.buckets.get(Math.floor(time / GROUP_SECONDS)) ?? [];
        for (const index of bucket) {
            if (this.isCurrent(index, time)) {
                this.cacheIndex = index;
                this.backupIndex = index;
                return index;
            }
        }

        return this.backupIndex;
    }

    /**
     * 句子的起始时间（兼容 start/end 写反的数据）。
     *
     * @param index 字幕下标。
     * @returns 起始时间。
     */
    private start(index: number): number {
        const line = this.lines[index];
        return Math.min(line.start, line.end);
    }

    /**
     * 句子的结束时间（兼容 start/end 写反的数据）。
     *
     * @param index 字幕下标。
     * @returns 结束时间。
     */
    private end(index: number): number {
        const line = this.lines[index];
        return Math.max(line.start, line.end);
    }

    /**
     * 下一句的起始时间；最后一句取自身起始时间。
     *
     * @param index 字幕下标。
     * @returns 下一句起始时间。
     */
    private nextStart(index: number): number {
        return this.start(Math.min(index + 1, this.lines.length - 1));
    }

    /**
     * 判断某句在时间上是否覆盖当前播放位置。
     *
     * 有效范围是 [min(start,end,nextStart), max(start,end,nextStart)]，
     * 也就是把句尾到下一句开头之间的空隙算在当前句上。
     *
     * @param index 字幕下标。
     * @param time 播放时间，单位秒。
     * @returns 覆盖当前时间时为 true。
     */
    private isCurrent(index: number, time: number): boolean {
        const start = Math.min(this.start(index), this.end(index), this.nextStart(index));
        const end = Math.max(this.start(index), this.end(index), this.nextStart(index));
        return time >= start && time <= end;
    }
}
