import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import StrUtil from '@/common/utils/str-util';

/**
 * A simple utility for converting ASS subtitle format to SRT format.
 * This utility focuses on extracting dialogue events and converting them
 * to SRT-compatible lines, discarding all styling and complex features of ASS.
 */
export default class AssUtil {
    /**
     * Converts the content of an .ass file to an .srt file content string.
     * @param assContent The full string content of the .ass file.
     * @returns A string representing the content of an .srt file.
     */
    public static assToSrt(assContent: string): string {
        if (StrUtil.isBlank(assContent)) {
            return '';
        }

        const lines = assContent.split(/\r?\n/);
        let inEventsSection = false;
        const srtLines: SrtLine[] = [];
        let dialogueFormat: string[] = [];
        let formatTextIndex = -1;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('[Events]')) {
                inEventsSection = true;
                continue;
            }

            if (!inEventsSection || StrUtil.isBlank(trimmedLine)) {
                continue;
            }

            if (trimmedLine.startsWith('Format:')) {
                dialogueFormat = trimmedLine.substring(7).trim().split(',').map(f => f.trim());
                formatTextIndex = dialogueFormat.findIndex(f => f.toLowerCase() === 'text');
                continue;
            }

            if (trimmedLine.startsWith('Dialogue:')) {
                if (formatTextIndex === -1) continue; // Skip if format not defined

                const parts = trimmedLine.substring(9).trim().split(',');
                if (parts.length < formatTextIndex + 1) continue; // Skip malformed lines

                const startTime = this.assTimeToSrtSeconds(parts[dialogueFormat.indexOf('Start')]);
                const endTime = this.assTimeToSrtSeconds(parts[dialogueFormat.indexOf('End')]);
                const text = parts.slice(formatTextIndex).join(',');

                if (startTime === null || endTime === null || StrUtil.isBlank(text)) {
                    continue;
                }

                // Remove ASS styling tags (e.g., {\b1})
                const cleanText = text.replace(/\{[^}]+\}/g, '').replace(/\\N/g, '\n').trim();

                if (StrUtil.isNotBlank(cleanText)) {
                    srtLines.push(SrtUtil.createSrtLine(
                        srtLines.length + 1,
                        startTime,
                        endTime,
                        cleanText,
                        ''
                    ));
                }
            }
        }

        return SrtUtil.srtLinesToSrt(srtLines, { reindex: true });
    }

    /**
     * Converts ASS time format (H:MM:SS.ss) to seconds.
     * @param timeString The time string from the ASS file.
     * @returns The time in seconds, or null if parsing fails.
     */
    private static assTimeToSrtSeconds(timeString: string | undefined): number | null {
        if (!timeString) {
            return null;
        }

        const parts = timeString.split(':');
        if (parts.length !== 3) {
            return null;
        }

        try {
            const hours = parseFloat(parts[0]);
            const minutes = parseFloat(parts[1]);
            const secondsAndCentiseconds = parseFloat(parts[2]);
            return hours * 3600 + minutes * 60 + secondsAndCentiseconds;
        } catch (e) {
            return null;
        }
    }
}
