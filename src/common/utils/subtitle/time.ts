import moment from 'moment';

const TIME_FORMAT = 'HH:mm:ss.SSS';

/**
 * 错误信息格式化工具。
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
 * 归一化时间文本为 moment 可严格解析的 "HH:mm:ss.SSS"。
 *
 * 接受 "HH:mm:ss,SSS" / "HH:mm:ss.SSS" / "mm:ss(.SSS)"，逗号毫秒分隔符统一转为点。
 *
 * @param timeString 原始时间文本。
 * @returns 归一化后的时间文本。
 */
function normalizeTimeString(timeString: string): string {
    const raw = (timeString ?? '').trim();
    if (!raw) {
        throw new Error('Invalid time string');
    }

    const normalized = raw.replace(',', '.');
    const [timePart, msPartRaw] = normalized.split('.', 2);
    const hms = timePart.split(':');

    let hours = '00';
    let minutes = '00';
    let seconds = '00';

    if (hms.length === 2) {
        [minutes, seconds] = hms;
    } else if (hms.length === 3) {
        [hours, minutes, seconds] = hms;
    } else {
        throw new Error(`Invalid time format: ${timeString}`);
    }

    const msPart = (msPartRaw ?? '000').padEnd(3, '0').slice(0, 3);
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${msPart}`;
}

/**
 * 将时间文本解析为秒数，是全仓库唯一的"时间文本→秒"实现。
 *
 * 覆盖 SRT/VTT/ASS 时间戳（"01:23:45,678"、"01:23:45.678"）与时长文本（"mm:ss"）。
 *
 * @param timeString 时间文本。
 * @returns 秒数（含毫秒小数）。
 */
export function timeTextToSeconds(timeString: string): number {
    try {
        const normalizedTime = normalizeTimeString(timeString);
        const time = moment(normalizedTime, TIME_FORMAT, true);

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
    const duration = moment.duration(totalMs);

    const hours = Math.floor(duration.asHours()).toString().padStart(2, '0');
    const minutes = duration.minutes().toString().padStart(2, '0');
    const secs = duration.seconds().toString().padStart(2, '0');
    const ms = duration.milliseconds().toString().padStart(3, '0');

    return `${hours}:${minutes}:${secs},${ms}`;
}
