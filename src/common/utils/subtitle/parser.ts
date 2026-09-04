import Util from '@/common/utils/Util';
import StrUtil from '@/common/utils/str-util';
import { Nullable } from '@/common/types/Types';
import { SrtLine, createSrtLine } from './types';
import { timeTextToSeconds } from './time';

const CHINESE_REGEX = /[\u4e00-\u9fa5]/;
const SRT_BLOCK_SEPARATOR = /\r?\n\r?\n/;
const LINE_SEPARATOR = /\r?\n/;
const TIME_ARROW = ' --> ';

interface ParsedSrtBlock {
    index: number;
    timeString: string;
    contentLines: string[];
}

/**
 * 检测字符串是否包含中文。
 */
function isChinese(str: string): boolean {
    return CHINESE_REGEX.test(str);
}

/**
 * 按是否含中文把块内正文行分为英文与中文两部分。
 *
 * @param lines 块内正文行。
 * @returns 合并后的英文与中文内容。
 */
function parseContentLines(lines: string[]): { contentEn: string; contentZh: string } {
    const contentZh: string[] = [];
    const contentEn: string[] = [];

    for (const line of lines) {
        const trimmedLine = Util.trim(line);
        if (trimmedLine) {
            if (isChinese(line)) {
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
 * 解析单个 SRT/WebVTT 文本块为结构化数据。
 *
 * @param block 文本块。
 * @param fallbackIndex 块首行不是序号行时使用的兜底序号。
 * @returns 结构化块；无法识别时间轴时返回 null。
 */
function parseSrtBlock(block: Nullable<string>, fallbackIndex?: number): ParsedSrtBlock | null {
    if (StrUtil.isBlank(block)) {
        return null;
    }

    const lines = block.trim().split(LINE_SEPARATOR);

    if (lines.length < 2) {
        return null;
    }

    try {
        const indexLine = lines[0]?.trim() ?? '';
        let timeLine = '';
        let contentOffset = 0;

        if (/^\d+$/.test(indexLine)) {
            const parsed = parseInt(indexLine, 10);
            if (isNaN(parsed) || parsed <= 0) {
                return null;
            }
            timeLine = lines[1] ?? '';
            contentOffset = 2;
            fallbackIndex = parsed;
        } else if (indexLine.includes('-->')) {
            timeLine = lines[0] ?? '';
            contentOffset = 1;
        } else if ((lines[1] ?? '').includes('-->')) {
            // WebVTT cue identifier + 时间行
            timeLine = lines[1] ?? '';
            contentOffset = 2;
        }

        const index = fallbackIndex ?? 0;
        if (index <= 0) {
            return null;
        }

        if (!timeLine.includes('-->')) {
            return null;
        }

        const [startRaw, endRawWithSettings] = timeLine.split('-->', 2);
        if (StrUtil.isBlank(startRaw) || StrUtil.isBlank(endRawWithSettings)) {
            return null;
        }
        const startTime = startRaw.trim().split(/\s+/)[0] ?? '';
        const endTime = endRawWithSettings.trim().split(/\s+/)[0] ?? '';
        if (StrUtil.isBlank(startTime) || StrUtil.isBlank(endTime)) {
            return null;
        }

        const timeString = `${startTime}${TIME_ARROW}${endTime}`;
        const contentLines = lines.slice(contentOffset).filter(line => line.trim().length > 0);

        return {
            index,
            timeString,
            contentLines
        };
    } catch (error: unknown) {
        console.warn('failed to parse srt block', { error });
        return null;
    }
}

/**
 * 将结构化块转换为字幕行。
 *
 * @param parsedBlock 已解析的块。
 * @returns 字幕行；时间轴非法时抛错。
 */
function parsedBlockToSrtLine(parsedBlock: ParsedSrtBlock): SrtLine {
    const timeParts = parsedBlock.timeString.split(TIME_ARROW);
    if (timeParts.length !== 2) {
        throw new Error('Invalid time format in SRT block');
    }

    const start = timeTextToSeconds(timeParts[0].trim());
    const end = timeTextToSeconds(timeParts[1].trim());

    if (end <= start) {
        throw new Error('End time must be greater than start time');
    }

    const { contentEn, contentZh } = parseContentLines(parsedBlock.contentLines);

    return createSrtLine(parsedBlock.index, start, end, contentEn, contentZh);
}

/**
 * 直接将 SRT 文本块转换为字幕行。
 *
 * @param block 文本块。
 * @param fallbackIndex 兜底序号。
 * @returns 字幕行；解析失败时返回 null。
 */
function srtBlockToSrtLine(block: Nullable<string>, fallbackIndex?: number): SrtLine | null {
    const parsedBlock = parseSrtBlock(block, fallbackIndex);
    if (!parsedBlock) {
        return null;
    }

    try {
        return parsedBlockToSrtLine(parsedBlock);
    } catch (error: unknown) {
        console.warn('failed to convert srt block to srtline', { error });
        return null;
    }
}

/**
 * 解析 SRT 文件内容为字幕行数组，同时兼容 WebVTT。
 *
 * 自动过滤 WEBVTT/NOTE/STYLE/REGION 头与 cue identifier，剥离子样式标签。
 *
 * @param srtContent SRT 或 WebVTT 文件全文。
 * @returns 字幕行数组；空内容返回空数组。
 */
export function parseSrt(srtContent: Nullable<string>): SrtLine[] {
    if (StrUtil.isBlank(srtContent)) {
        return [];
    }

    const blocks = srtContent
        .replace(/^\uFEFF/, '')
        .split(SRT_BLOCK_SEPARATOR)
        .map(block => block.trim())
        .filter(block => block.length > 0)
        .filter((block) => {
            const firstLine = block.split(LINE_SEPARATOR)[0]?.trim() ?? '';
            const upper = firstLine.toUpperCase();
            if (upper.startsWith('WEBVTT')) return false;
            if (upper.startsWith('NOTE')) return false;
            if (upper.startsWith('STYLE')) return false;
            if (upper.startsWith('REGION')) return false;
            return true;
        })
        .map(block => block
            .replace(/{\w+}/g, '')
            .replace(/<\/?c[^>]*>/g, '')
            .replace(/<\/?v[^>]*>/g, '')
        ); // 移除样式/WEBVTT 标签

    const srtLines: SrtLine[] = [];

    for (const block of blocks) {
        const srtLine = srtBlockToSrtLine(block, srtLines.length + 1);
        if (srtLine) {
            srtLines.push(srtLine);
        }
    }

    return srtLines;
}

/**
 * 解析 ASS 文件内容为字幕行数组（纯文本模式，不解析样式/特效）。
 *
 * 仅提取 [Events] 段每个 Dialogue 行的开始/结束时间与正文，剥离 {\...} 样式标签；
 * 忽略 [Script Info] / [V4+ Styles] 等元数据段落。
 *
 * @param assContent ASS 文件全文。
 * @returns 按出现顺序排列的字幕行数组。
 */
export function parseAss(assContent: Nullable<string>): SrtLine[] {
    if (StrUtil.isBlank(assContent)) {
        return [];
    }

    const lines = assContent
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .split('\n');

    const srtLines: SrtLine[] = [];
    let fallbackIndex = 1;

    // 记录 [Events] 段声明的字段顺序，默认使用标准布局
    // Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    let eventFields: string[] = [];
    let inEventsSection = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const upper = line.toUpperCase();

        if (upper.startsWith('[')) {
            inEventsSection = upper.startsWith('[EVENTS]');
            if (!inEventsSection) {
                continue;
            }
        }
        if (!inEventsSection) {
            continue;
        }
        if (upper.startsWith('FORMAT:')) {
            eventFields = line.slice('FORMAT:'.length).split(',').map((f) => f.trim().toUpperCase());
            continue;
        }
        if (!upper.startsWith('DIALOGUE:')) {
            continue;
        }

        const fieldMap = new Map<string, string>();
        const parts = line.split(',');
        // 去掉首字段上的 "Dialogue:" 前缀（字段顺序可被 Format 重排）
        parts[0] = parts[0]?.replace(/^DIALOGUE:\s*/i, '') ?? '';
        for (let i = 0; i < parts.length; i++) {
            const fieldName = eventFields[i] ?? '';
            if (fieldName) {
                fieldMap.set(fieldName, parts[i].trim());
            }
        }
        // 正文可能包含逗号，若声明了 Text 字段则把剩余部分拼回 Text
        if (eventFields.includes('TEXT')) {
            const textIndex = eventFields.indexOf('TEXT');
            const joined = parts.slice(textIndex).join(',').trim();
            if (joined) {
                fieldMap.set('TEXT', joined);
            }
        }

        // 缺少必须字段或未声明 Format 时按标准布局兜底解析
        const startRaw = fieldMap.get('START') ?? parts[1]?.trim() ?? '';
        const endRaw = fieldMap.get('END') ?? parts[2]?.trim() ?? '';
        const text = fieldMap.get('TEXT') ?? parts.slice(9).join(',').trim();
        if (!startRaw || !endRaw || !text) {
            continue;
        }

        try {
            const start = timeTextToSeconds(startRaw);
            const end = timeTextToSeconds(endRaw);
            if (end <= start) {
                continue;
            }
            // 剥离 ASS 样式标签（保留 \N 换行，交给后续内容拆分）
            const cleaned = text.replace(/{\\[^}]*}/g, '');
            const contentLines = cleaned
                .replace(/\\N/gi, '\n')
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
            if (contentLines.length === 0) {
                continue;
            }
            const { contentEn, contentZh } = parseContentLines(contentLines);
            const srtLine = createSrtLine(fallbackIndex, start, end, contentEn, contentZh);
            srtLines.push(srtLine);
            fallbackIndex += 1;
        } catch (error: unknown) {
            console.warn('failed to parse ass dialogue', { error, line: rawLine });
            continue;
        }
    }

    return srtLines;
}
