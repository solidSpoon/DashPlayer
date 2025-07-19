import moment from 'moment';
import Util from '@/common/utils/Util';
import { Sentence } from '@/common/types/SentenceC';
import StrUtil from "@/common/utils/str-util";
import {Nullable} from "@/common/types/Types";

// 使用 interface 并设为只读
export interface SrtLine {
    readonly index: number;
    readonly start: number;
    readonly end: number;
    readonly contentEn: string;
    readonly contentZh: string;
}

// 常量定义
const CHINESE_REGEX = /[\u4e00-\u9fa5]/;
const SRT_BLOCK_SEPARATOR = /\r?\n\r?\n/;
const LINE_SEPARATOR = /\r?\n/;
const TIME_ARROW = ' --> ';
const SRT_TIME_FORMAT = 'HH:mm:ss.SSS';

interface ParsedSrtBlock {
    index: number;
    timeString: string;
    contentLines: string[];
}

/**
 * 错误信息格式化工具
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

/**
 * SRT字幕处理工具类
 * 统一使用 SrtLine 作为数据交互接口，内部方法复用
 */
export default class SrtUtil {

    // ==================== 基础工具方法（被其他方法复用） ====================

    /**
     * 将 SRT 时间格式转换为秒数
     * @param timeString 格式: "01:23:45,678" 或 "01:23:45.678"
     */
    public static timeStringToSeconds(timeString: string): number {
        if (!timeString) {
            throw new Error('Invalid time string');
        }

        try {
            const normalizedTime = timeString.replace(',', '.');
            const time = moment(normalizedTime, SRT_TIME_FORMAT, true);

            if (!time.isValid()) {
                throw new Error(`Invalid time format: ${timeString}`);
            }

            return time.hours() * 3600 +
                time.minutes() * 60 +
                time.seconds() +
                time.milliseconds() / 1000;
        } catch (error: unknown) {
            throw new Error(`Failed to parse time: ${timeString} - ${getErrorMessage(error)}`);
        }
    }

    /**
     * 将秒数转换为 SRT 时间格式
     * @param seconds 秒数
     */
    public static secondsToTimeString(seconds: number): string {
        if (seconds < 0 || !isFinite(seconds)) {
            throw new Error('Invalid seconds value');
        }

        const duration = moment.duration(seconds * 1000);

        const hours = Math.floor(duration.asHours()).toString().padStart(2, '0');
        const minutes = duration.minutes().toString().padStart(2, '0');
        const secs = duration.seconds().toString().padStart(2, '0');
        const ms = duration.milliseconds().toString().padStart(3, '0');

        return `${hours}:${minutes}:${secs},${ms}`;
    }

    /**
     * 检测字符串是否包含中文
     */
    public static isChinese(str: string): boolean {
        return CHINESE_REGEX.test(str);
    }

    /**
     * 验证时间格式
     */
    public static isValidTimeFormat(timeString: string): boolean {
        try {
            this.timeStringToSeconds(timeString); // 复用解析方法
            return true;
        } catch (error: unknown) {
            return false;
        }
    }

    /**
     * 分离内容的中英文
     */
    private static parseContentLines(lines: string[]): { contentEn: string; contentZh: string } {
        const contentZh: string[] = [];
        const contentEn: string[] = [];

        for (const line of lines) {
            const trimmedLine = Util.trim(line);
            if (trimmedLine) {
                if (this.isChinese(line)) {
                    contentZh.push(trimmedLine);
                } else {
                    contentEn.push(trimmedLine);
                }
            }
        }

        return {
            contentEn: contentEn.join(' '),
            contentZh: contentZh.join(' ')
        };
    }

    /**
     * 验证 SrtLine 的核心逻辑
     */
    public static validateSrtLine(srtLine: SrtLine): boolean {
        return (
            srtLine.index > 0 &&
            srtLine.start >= 0 &&
            srtLine.end > srtLine.start &&
            isFinite(srtLine.start) &&
            isFinite(srtLine.end)
        );
    }

    /**
     * 获取内容文本（根据类型选择）
     */
    private static getContentByType(
        srtLine: SrtLine,
        contentType: 'en' | 'zh' | 'both' | 'auto',
        separator = '\n'
    ): string {
        switch (contentType) {
            case 'en':
                return srtLine.contentEn;
            case 'zh':
                return srtLine.contentZh;
            case 'both':
                return [srtLine.contentEn, srtLine.contentZh]
                    .filter(c => c.trim().length > 0)
                    .join(separator);
            case 'auto':
            default:
                return srtLine.contentEn || srtLine.contentZh;
        }
    }

    /**
     * 检查 SrtLine 是否为空内容
     */
    private static isEmptyContent(srtLine: SrtLine): boolean {
        return srtLine.contentEn.trim().length === 0 && srtLine.contentZh.trim().length === 0;
    }

    // ==================== SrtLine 操作方法（复用基础方法） ====================

    /**
     * 创建 SrtLine
     */
    public static createSrtLine(
        index: number,
        start: number,
        end: number,
        contentEn = '',
        contentZh = ''
    ): SrtLine {
        const srtLine: SrtLine = {
            index,
            start,
            end,
            contentEn,
            contentZh
        };

        if (!this.validateSrtLine(srtLine)) {
            throw new Error('Invalid SrtLine parameters');
        }

        return srtLine;
    }

    /**
     * 从 Sentence 创建 SrtLine（复用 createSrtLine）
     */
    public static fromSentence(sentence: Sentence): SrtLine {
        return this.createSrtLine(
            sentence.index,
            sentence.start,
            sentence.end,
            sentence.text ?? '',
            sentence.textZH ?? ''
        );
    }

    /**
     * 克隆 SrtLine（复用 createSrtLine）
     */
    public static cloneSrtLine(srtLine: SrtLine): SrtLine {
        return this.createSrtLine(
            srtLine.index,
            srtLine.start,
            srtLine.end,
            srtLine.contentEn,
            srtLine.contentZh
        );
    }

    /**
     * 更新 SrtLine 的部分属性（复用 createSrtLine）
     */
    public static updateSrtLine(
        srtLine: SrtLine,
        updates: Partial<Omit<SrtLine, 'readonly'>>
    ): SrtLine {
        return this.createSrtLine(
            updates.index ?? srtLine.index,
            updates.start ?? srtLine.start,
            updates.end ?? srtLine.end,
            updates.contentEn ?? srtLine.contentEn,
            updates.contentZh ?? srtLine.contentZh
        );
    }

    // ==================== SRT Block 解析和转换（复用基础方法） ====================

    /**
     * 解析单个 SRT 文本块为结构化数据
     */
    public static parseSrtBlock(block: Nullable<string>): ParsedSrtBlock | null {
        if (StrUtil.isBlank(block)) {
            return null;
        }

        const lines = block.trim().split(LINE_SEPARATOR);

        if (lines.length < 3) {
            return null;
        }

        try {
            const index = parseInt(lines[0], 10);
            if (isNaN(index) || index <= 0) {
                return null;
            }

            const timeString = lines[1];
            if (!timeString.includes(TIME_ARROW)) {
                return null;
            }

            const contentLines = lines.slice(2).filter(line => line.trim().length > 0);

            return {
                index,
                timeString,
                contentLines
            };
        } catch (error: unknown) {
            console.warn('Failed to parse SRT block:', getErrorMessage(error));
            return null;
        }
    }

    /**
     * 将解析的 SRT 块转换为 SrtLine（复用时间解析和内容解析）
     */
    public static parsedBlockToSrtLine(parsedBlock: ParsedSrtBlock): SrtLine {
        const timeParts = parsedBlock.timeString.split(TIME_ARROW);
        if (timeParts.length !== 2) {
            throw new Error('Invalid time format in SRT block');
        }

        // 复用时间解析方法
        const start = this.timeStringToSeconds(timeParts[0].trim());
        const end = this.timeStringToSeconds(timeParts[1].trim());

        if (end <= start) {
            throw new Error('End time must be greater than start time');
        }

        // 复用内容解析方法
        const { contentEn, contentZh } = this.parseContentLines(parsedBlock.contentLines);

        // 复用创建方法
        return this.createSrtLine(parsedBlock.index, start, end, contentEn, contentZh);
    }

    /**
     * 直接将 SRT 文本块转换为 SrtLine（复用解析方法）
     */
    public static srtBlockToSrtLine(block: Nullable<string>): SrtLine | null {
        const parsedBlock = this.parseSrtBlock(block);
        if (!parsedBlock) {
            return null;
        }

        try {
            return this.parsedBlockToSrtLine(parsedBlock);
        } catch (error: unknown) {
            console.warn('Failed to convert SRT block to SrtLine:', getErrorMessage(error));
            return null;
        }
    }

    /**
     * 将单个 SrtLine 转换为 SRT 文本块（复用时间转换和内容获取）
     */
    public static srtLineToBlock(
        srtLine: SrtLine,
        options: {
            useOriginalIndex?: boolean;
            newIndex?: number;
            contentType?: 'en' | 'zh' | 'both' | 'auto';
            separator?: string;
        } = {}
    ): string {
        const {
            useOriginalIndex = true,
            newIndex,
            contentType = 'auto',
            separator = '\n'
        } = options;

        const index = useOriginalIndex ? srtLine.index : (newIndex ?? srtLine.index);

        // 复用时间转换方法
        const startTime = this.secondsToTimeString(srtLine.start);
        const endTime = this.secondsToTimeString(srtLine.end);
        const timeString = `${startTime} --> ${endTime}`;

        // 复用内容获取方法
        const content = this.getContentByType(srtLine, contentType, separator);

        return `${index}\n${timeString}\n${content}`;
    }

    // ==================== 集合操作方法（复用基础方法） ====================

    /**
     * 按时间排序（复用验证方法）
     */
    public static sortByTime(srtLines: SrtLine[]): SrtLine[] {
        return srtLines.filter(line => this.validateSrtLine(line))
            .sort((a, b) => a.start - b.start);
    }

    /**
     * 按索引排序（复用验证方法）
     */
    public static sortByIndex(srtLines: SrtLine[]): SrtLine[] {
        return srtLines.filter(line => this.validateSrtLine(line))
            .sort((a, b) => a.index - b.index);
    }

    /**
     * 过滤空内容（复用空内容检查）
     */
    public static filterEmpty(srtLines: SrtLine[]): SrtLine[] {
        return srtLines.filter(line => !this.isEmptyContent(line));
    }

    /**
     * 过滤有效的字幕行（复用验证方法）
     */
    public static filterValid(srtLines: SrtLine[]): SrtLine[] {
        return srtLines.filter(line => this.validateSrtLine(line));
    }

    /**
     * 根据索引查找
     */
    public static findByIndex(srtLines: SrtLine[], index: number): SrtLine | undefined {
        return this.filterValid(srtLines).find(line => line.index === index);
    }

    /**
     * 根据时间查找重叠的字幕
     */
    public static findByTimeRange(
        srtLines: SrtLine[],
        startTime: number,
        endTime: number
    ): SrtLine[] {
        return this.filterValid(srtLines).filter(line =>
            !(line.end <= startTime || line.start >= endTime)
        );
    }

    /**
     * 获取指定索引周围的字幕（复用排序和过滤方法）
     */
    public static getAround(srtLines: SrtLine[], targetIndex: number, range: number): SrtLine[] {
        if (range < 0) {
            return [];
        }

        const sortedLines = this.sortByIndex(srtLines);
        if (sortedLines.length === 0) {
            return [];
        }

        const minIndex = sortedLines[0].index;
        const maxIndex = sortedLines[sortedLines.length - 1].index;

        const start = Math.max(minIndex, targetIndex - range);
        const end = Math.min(maxIndex, targetIndex + range);

        return sortedLines.filter(line => line.index >= start && line.index <= end);
    }

    // ==================== 时间操作方法（复用基础方法） ====================

    /**
     * 时间偏移（复用更新方法）
     */
    public static offsetTime(srtLines: SrtLine[], offsetSeconds: number): SrtLine[] {
        if (!isFinite(offsetSeconds)) {
            throw new Error('Invalid offset value');
        }

        return srtLines.map(line =>
            this.updateSrtLine(line, {
                start: Math.max(0, line.start + offsetSeconds),
                end: Math.max(0, line.end + offsetSeconds)
            })
        );
    }

    /**
     * 时间缩放（复用更新方法）
     */
    public static scaleTime(srtLines: SrtLine[], scale: number): SrtLine[] {
        if (!isFinite(scale) || scale <= 0) {
            throw new Error('Invalid scale value');
        }

        return srtLines.map(line =>
            this.updateSrtLine(line, {
                start: line.start * scale,
                end: line.end * scale
            })
        );
    }

    /**
     * 合并重叠的字幕（复用排序、克隆、更新方法）
     */
    public static mergeOverlapping(srtLines: SrtLine[]): SrtLine[] {
        if (!srtLines || srtLines.length <= 1) {
            return [...(srtLines || [])];
        }

        const sortedLines = this.sortByTime(srtLines);
        const merged: SrtLine[] = [];
        let current = this.cloneSrtLine(sortedLines[0]);

        for (let i = 1; i < sortedLines.length; i++) {
            const next = sortedLines[i];

            if (current.end >= next.start) {
                // 重叠，合并（复用更新方法）
                current = this.updateSrtLine(current, {
                    end: Math.max(current.end, next.end),
                    contentEn: [current.contentEn, next.contentEn]
                        .filter(Boolean)
                        .join(' '),
                    contentZh: [current.contentZh, next.contentZh]
                        .filter(Boolean)
                        .join(' ')
                });
            } else {
                // 不重叠，保存当前并开始新的
                merged.push(current);
                current = this.cloneSrtLine(next);
            }
        }

        merged.push(current);
        return merged;
    }

    // ==================== 高级方法（复用基础方法） ====================

    /**
     * 解析 SRT 文件内容为 SrtLine 数组（复用块转换方法）
     */
    public static parseSrt(srtContent: Nullable<string>): SrtLine[] {
        if (StrUtil.isBlank(srtContent)) {
            return [];
        }

        const blocks = srtContent
            .split(SRT_BLOCK_SEPARATOR)
            .map(block => block.trim())
            .filter(block => block.length > 0)
            .map(block => block.replace(/{\w+}/g, '')); // 移除样式标签

        const srtLines: SrtLine[] = [];

        for (const block of blocks) {
            const srtLine = this.srtBlockToSrtLine(block); // 复用块转换方法
            if (srtLine) {
                srtLines.push(srtLine);
            }
        }

        return srtLines;
    }

    /**
     * 将多个 SrtLine 转换为完整的 SRT 文本（复用多个方法）
     */
    public static srtLinesToSrt(
        srtLines: SrtLine[],
        options: {
            reindex?: boolean;
            sortByTime?: boolean;
            contentType?: 'en' | 'zh' | 'both' | 'auto';
            separator?: string;
            filterEmpty?: boolean;
        } = {}
    ): string {
        if (!srtLines || srtLines.length === 0) {
            return '';
        }

        const {
            reindex = false,
            sortByTime = true,
            contentType = 'auto',
            separator = '\n',
            filterEmpty = true
        } = options;

        let lines = [...srtLines];

        // 复用过滤方法
        if (filterEmpty) {
            lines = this.filterEmpty(lines);
        }

        // 复用排序方法
        if (sortByTime) {
            lines = this.sortByTime(lines);
        }

        // 复用块转换方法
        const blocks = lines.map((line, index) =>
            this.srtLineToBlock(line, {
                useOriginalIndex: !reindex,
                newIndex: reindex ? index + 1 : undefined,
                contentType,
                separator
            })
        );

        return blocks.join('\n\n');
    }

    /**
     * 生成标准 SRT 文件内容（复用转换方法）
     */
    public static generateSrt(srtLines: SrtLine[], reindex = false): string {
        return this.srtLinesToSrt(srtLines, { reindex });
    }

    /**
     * 获取统计信息（复用排序和时间转换方法）
     */
    public static getStatistics(srtLines: SrtLine[]): {
        totalCount: number;
        totalDuration: string;
        averageDuration: string;
        firstSubtitle: string;
        lastSubtitle: string;
        chineseCount: number;
        englishCount: number;
        emptyCount: number;
    } {
        if (!srtLines || srtLines.length === 0) {
            const emptyTime = this.secondsToTimeString(0); // 复用时间转换
            return {
                totalCount: 0,
                totalDuration: emptyTime,
                averageDuration: emptyTime,
                firstSubtitle: emptyTime,
                lastSubtitle: emptyTime,
                chineseCount: 0,
                englishCount: 0,
                emptyCount: 0
            };
        }

        const sortedLines = this.sortByTime(srtLines); // 复用排序方法
        const totalSeconds = srtLines.reduce((sum, line) => sum + (line.end - line.start), 0);
        const averageSeconds = totalSeconds / srtLines.length;
        const chineseCount = srtLines.filter(line => line.contentZh.length > 0).length;
        const englishCount = srtLines.filter(line => line.contentEn.length > 0).length;
        const emptyCount = srtLines.filter(line => this.isEmptyContent(line)).length; // 复用空内容检查

        return {
            totalCount: srtLines.length,
            totalDuration: this.secondsToTimeString(totalSeconds), // 复用时间转换
            averageDuration: this.secondsToTimeString(averageSeconds), // 复用时间转换
            firstSubtitle: this.secondsToTimeString(sortedLines[0].start), // 复用时间转换
            lastSubtitle: this.secondsToTimeString(sortedLines[sortedLines.length - 1].end), // 复用时间转换
            chineseCount,
            englishCount,
            emptyCount
        };
    }
}
