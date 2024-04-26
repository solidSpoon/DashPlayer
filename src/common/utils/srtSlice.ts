import SrtUtil from "@/common/utils/SrtUtil";

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
}
export const getSubtitleContent = (srt: string, no: number): string | undefined => {
    // Parse the SRT string into an array of subtitle objects
    const subtitles = SrtUtil.parseSrt(srt);

    // Find the subtitle object with the given number
    const subtitle = subtitles.find(subtitle => subtitle.index === no);

    // Return the content of the found subtitle
    return subtitle ? subtitle.contentEn : undefined;
}
