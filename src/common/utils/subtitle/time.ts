/**
 * 时间文本与秒数互转，是全仓库唯一的实现。
 *
 * 覆盖 SRT/VTT/ASS 时间戳（"01:23:45,678"、"01:23:45.678"）与时长文本
 * （"mm:ss"、"99:59:59" 这类越界小时的视频结尾哨兵值）。只校验结构
 * （数字、冒号分组），不限制小时/分钟/秒的数值范围。
 */

/**
 * 解析时间文本为秒数。
 *
 * @param timeString 时间文本。
 * @returns 秒数（含毫秒小数）；结构非法（空串、非数字单位）时抛错。
 */
export function timeTextToSeconds(timeString: string): number {
    const raw = (timeString ?? '').trim();
    if (!raw) {
        throw new Error('Invalid time string');
    }

    const normalized = raw.replace(',', '.');
    const [timePart, msPartRaw] = normalized.split('.', 2);
    const hms = timePart.split(':');

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (hms.length === 2) {
        minutes = parseUnit(hms[0], raw);
        seconds = parseUnit(hms[1], raw);
    } else if (hms.length === 3) {
        hours = parseUnit(hms[0], raw);
        minutes = parseUnit(hms[1], raw);
        seconds = parseUnit(hms[2], raw);
    } else {
        throw new Error(`Invalid time format: ${timeString}`);
    }

    let ms = 0;
    if (msPartRaw !== undefined) {
        if (!/^\d*$/.test(msPartRaw)) {
            throw new Error(`Invalid time format: ${timeString}`);
        }
        ms = parseInt(msPartRaw.padEnd(3, '0').slice(0, 3), 10);
    }

    return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * 将秒数格式化为 SRT 时间戳 "HH:mm:ss,SSS"。
 *
 * @param seconds 秒数。
 * @returns SRT 时间戳文本；入参非有限正数时抛错。
 */
export function secondsToSrtTimestamp(seconds: number): string {
    if (seconds < 0 || !isFinite(seconds)) {
        throw new Error('Invalid seconds value');
    }

    const totalMs = Math.round(seconds * 1000);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const secs = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    const mss = ms.toString().padStart(3, '0');

    return `${hh}:${mm}:${ss},${mss}`;
}

/**
 * 解析单个时间单位，拒绝非数字。
 */
function parseUnit(part: string, raw: string): number {
    if (!/^\d+$/.test(part)) {
        throw new Error(`Invalid time format: ${raw}`);
    }
    return parseInt(part, 10);
}
