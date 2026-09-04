/**
 * 字幕行数据结构：全模块统一的数据交互接口。
 */
export interface SrtLine {
    readonly index: number;
    readonly start: number;
    readonly end: number;
    readonly contentEn: string;
    readonly contentZh: string;
}

/**
 * 校验字幕行字段是否合法。
 *
 * @param srtLine 待校验的字幕行。
 * @returns 序号非负、时间有限且结束晚于开始时为 true。
 */
export function validateSrtLine(srtLine: SrtLine): boolean {
    return (
        srtLine.index >= 0 &&
        srtLine.start >= 0 &&
        srtLine.end > srtLine.start &&
        isFinite(srtLine.start) &&
        isFinite(srtLine.end)
    );
}

/**
 * 创建并校验字幕行。
 *
 * @param index 行序号。
 * @param start 开始时间（秒）。
 * @param end 结束时间（秒）。
 * @param contentEn 英文正文。
 * @param contentZh 中文正文。
 * @returns 合法的字幕行；参数非法时抛错。
 */
export function createSrtLine(
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

    if (!validateSrtLine(srtLine)) {
        throw new Error('Invalid SrtLine parameters');
    }

    return srtLine;
}
