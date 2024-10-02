import Util from '@/common/utils/Util';
import { Sentence } from '@/common/types/SentenceC';
import { ClipSrtLine } from '@/common/types/OssObject';
import CollUtil from '@/common/utils/CollUtil';


export type SrtLine = {
    index: number;
    start: number;
    end: number;
    contentEn: string;
    contentZh: string;
}

/**
 * 把字符串格式的字幕时间转换为浮点数
 *
 * @return 浮点数格式的时间
 * @param t
 */
function toSeconds(t: string): number {
    let s = 0.0;
    if (t) {
        const p = t.split(':');
        let i;
        for (i = 0; i < p.length; i++) {
            s = s * 60 + parseFloat(p[i].replace(',', '.'));
        }
    }

    return s;
}

function isChinese(str: string): boolean {
    const re = /[\u4e00-\u9fa5]/;
    return re.test(str);
}

function toSrtTimestamp(seconds: number): string {
    const date = new Date(0);
    date.setSeconds(seconds);
    const timeString = date.toISOString().substr(11, 12);
    return timeString.replace('.', ',');
}

export default class SrtUtil {

    public static parseSrt(srt: string): SrtLine[] {
        const subtitles: SrtLine[] = [];
        let textSubtitles = srt.split(/\r?\n\r?\n/); // 每条字幕的信息，包含了序号，时间，字幕内容
        textSubtitles = textSubtitles
            .map(t => t.trim())
            .map((item) => item.replace(/{\w+}/, ''));
        for (let i = 0; i < textSubtitles.length; i += 1) {
            const textSubtitle = textSubtitles[i].split(/\r?\n/);

            if (textSubtitle.length >= 2) {
                const sn = textSubtitle[0]; // 字幕的序号
                const startTime = toSeconds(
                    textSubtitle[1].split(' --> ')[0].trim()
                ); // 字幕的开始时间
                const endTime = toSeconds(textSubtitle[1].split(' --> ')[1].trim()); // 字幕的结束时间
                const contentZh: string[] = []; // 字幕的内容
                const contentEn: string[] = [];
                // 字幕可能有多行

                for (let j = 2; j < textSubtitle.length; j++) {
                    const line = textSubtitle[j];
                    if (isChinese(line)) {
                        contentZh.push(Util.trim(line));
                    } else {
                        contentEn.push(Util.trim(line));
                    }
                }

                // 字幕对象
                const subtitle = {
                    index: Number(sn).valueOf(),
                    start: startTime,
                    end: endTime,
                    contentEn: contentEn.join(' '),
                    contentZh: contentZh.join(' ')
                };
                subtitles.push(subtitle);
            }
        }
        return subtitles;
    }

    /**
     * index 从1开始
     * @param lines
     */
    public static toNewSrt(lines: SrtLine[]): string {
        lines.sort((a, b) => a.start - b.start);
        const srtLines: string[] = [];
        let counter = 1;


        for (const wr of lines) {
            const startTime = toSrtTimestamp(wr.start);
            const endTime = toSrtTimestamp(wr.end);
            const text = wr.contentEn;
            const srtLine = `${counter}\n${startTime} --> ${endTime}\n${text}\n\n`;
            srtLines.push(srtLine);
            counter++;
        }

        return srtLines.join('');
    }

    /**
     * index 按照原始的index
     * @param lines
     */
    public static toSrt(lines: SrtLine[]): string {
        lines.sort((a, b) => a.start - b.start);
        const srtLines: string[] = [];
        for (const wr of lines) {
            const startTime = toSrtTimestamp(wr.start);
            const endTime = toSrtTimestamp(wr.end);
            const text = wr.contentEn;
            const srtLine = `${wr.index}\n${startTime} --> ${endTime}\n${text}\n\n`;
            srtLines.push(srtLine);
        }
        return srtLines.join('');
    }

    public static toSrtLine(sentence: Sentence): SrtLine {
        return {
            index: sentence.index,
            start: sentence.start,
            end: sentence.end,
            contentEn: sentence.text ?? '',
            contentZh: sentence.textZH ?? ''
        };
    }

    public static srtAround(lines: SrtLine[], indexInSrt: number, range: number): SrtLine[] {
        const srtMin = lines.map(l => l.index).reduce((a, b) => Math.min(a, b));
        const srtMax = lines.map(l => l.index).reduce((a, b) => Math.max(a, b));
        const start = Math.max(srtMin, indexInSrt - range);
        const end = Math.min(srtMax, indexInSrt + range);
        return lines.filter(l => l.index >= start && l.index <= end);
    }

    public static srtAt(lines: SrtLine[], indexInSrt: number): SrtLine | undefined {
        return lines.find(l => l.index === indexInSrt);
    }
}
