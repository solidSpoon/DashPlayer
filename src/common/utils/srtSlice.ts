import SrtUtil from '@/common/utils/SrtUtil';

/**
 * 将 SRT 文件切片，返回指定范围内的字幕内容。
 *
 * @param {string} srt - SRT 文件的内容。
 * @param {number} no - 要查找的字幕编号。
 * @param {number} range - 要返回的字幕范围。
 * @returns {string} - 指定范围内的字幕内容。
 */
export const srtSlice = (srt: string, no: number, range: number): string => {
    // Split the SRT file into an array of subtitles
    const subtitles = srt.split(/\n\s*\n/).map(subtitle => subtitle.trim());

    // Find the index of the subtitle with the given number
    const index = subtitles.findIndex(subtitle => subtitle.startsWith(no.toString()));

    // Calculate the start and end indices for the range of subtitles
    const start = Math.max(0, index - Math.floor(range));
    const end = Math.min(subtitles.length, index + Math.ceil(range));

    // Slice the array to get the range of subtitles and join them back into a string
    return subtitles.slice(start, end).join('\n\n');
};
/**
 * 获取指定编号的字幕内容。
 *
 * @param {string} srt - SRT 文件的内容。
 * @param {number} no - 要查找的字幕编号。
 * @returns {string | undefined} - 返回指定编号的字幕内容，如果未找到则返回 undefined。
 */
export const getSubtitleContent = (srt: string, no: number): string | undefined => {
    // Parse the SRT string into an array of subtitle objects
    const subtitles = SrtUtil.parseSrt(srt);

    // Find the subtitle object with the given number
    const subtitle = subtitles.find(subtitle => subtitle.index === no);

    // Return the content of the found subtitle
    return subtitle ? subtitle.contentEn : undefined;
};
