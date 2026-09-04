import { SrtLine, validateSrtLine } from './types';
import { secondsToSrtTimestamp } from './time';

/**
 * 检查字幕行是否为空内容。
 */
function isEmptyContent(srtLine: SrtLine): boolean {
    return srtLine.contentEn.trim().length === 0 && srtLine.contentZh.trim().length === 0;
}

/**
 * 按内容类型获取字幕行正文。
 *
 * @param srtLine 字幕行。
 * @param contentType 内容选择：en / zh / both / auto。
 * @param separator both 模式下的拼接分隔符。
 * @returns 正文文本。
 */
function getContentByType(
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
 * 按时间排序并过滤非法行。
 */
function sortByTime(srtLines: SrtLine[]): SrtLine[] {
    return srtLines.filter(line => validateSrtLine(line))
        .sort((a, b) => a.start - b.start);
}

/**
 * 将单个字幕行转换为 SRT 文本块。
 *
 * @param srtLine 字幕行。
 * @param options.useOriginalIndex 使用原始序号（默认 true）。
 * @param options.newIndex 重排后的新序号。
 * @param options.contentType 内容选择，默认 auto。
 * @returns SRT 文本块。
 */
function srtLineToBlock(
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

    const startTime = secondsToSrtTimestamp(srtLine.start);
    const endTime = secondsToSrtTimestamp(srtLine.end);
    const timeString = `${startTime} --> ${endTime}`;

    const content = getContentByType(srtLine, contentType, separator);

    return `${index}\n${timeString}\n${content}`;
}

/**
 * 将字幕行数组序列化为完整 SRT 文本。
 *
 * 默认过滤空内容并按开始时间排序。
 *
 * @param srtLines 字幕行数组。
 * @param options.reindex 按输出顺序重排序号（从 1 开始）。
 * @returns SRT 文本；空数组返回空字符串。
 */
export function serializeSrt(
    srtLines: SrtLine[],
    options: {
        reindex?: boolean;
    } = {}
): string {
    if (!srtLines || srtLines.length === 0) {
        return '';
    }

    const { reindex = false } = options;

    let lines = [...srtLines];

    lines = lines.filter(line => !isEmptyContent(line));
    lines = sortByTime(lines);

    const blocks = lines.map((line, index) =>
        srtLineToBlock(line, {
            useOriginalIndex: !reindex,
            newIndex: reindex ? index + 1 : undefined
        })
    );

    return blocks.join('\n\n');
}
