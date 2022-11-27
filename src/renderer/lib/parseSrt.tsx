/**
 * 把 SRT 格式的字幕文件解析为字幕的对象数组，格式为:
 * [
 *      {sn: "0", startTime: 0.89, endTime: 7.89, content: "这里是一系列与Hadoop↵有关的其他开源项目："},
 *      {sn: "1", startTime: 8.38, endTime: 14.85, content: "Eclipse是一个IBM贡献到开源社区里的集成开发环境（IDE）。"}
 * ]
 *
 * @param  string srt 字幕文件的内容
 * @return *[]
 */
import SentenceT from "./param/SentenceT";

export default function parseSrtSubtitles(srt: string): Array<SentenceT> {
    const subtitles: Array<SentenceT> = [];
    let textSubtitles = srt.split(/\r?\n\r?\n/); // 每条字幕的信息，包含了序号，时间，字幕内容
    textSubtitles = textSubtitles.map(item => item.replace(/{\w+}/, ''));
    for (let i = 0; i < textSubtitles.length; ++i) {
        const textSubtitle = textSubtitles[i].split(/\r?\n/);

        if (textSubtitle.length >= 2) {
            const sn = textSubtitle[0]; // 字幕的序号
            const startTime = toSeconds(textSubtitle[1].split(' --> ')[0].trim()); // 字幕的开始时间
            const endTime = toSeconds(textSubtitle[1].split(' --> ')[1].trim()); // 字幕的结束时间
            let contentZh = ''; // 字幕的内容
            let contentEn = '';
            // 字幕可能有多行

            for (var j = 2; j < textSubtitle.length; j++) {
                const line = textSubtitle[j];
                if (isChinese(line)) {
                    contentZh += line;
                } else {
                    contentEn += line;
                }
            }


            // 字幕对象
            const subtitle = new SentenceT();
            subtitle.key = sn;
            subtitle.sn = sn;
            subtitle.timeStart = startTime;
            subtitle.timeEnd = endTime;
            subtitle.text = contentEn;
            subtitle.textZH = contentZh !== '' ? contentZh : undefined;
            subtitles.push(subtitle);
        }
    }
    return subtitles;
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
