import path from 'path';

type SRTMatch = {
    path: string;
    priority: number;
};

function extractBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

function getLanguagePriority(langSuffix: string): number {
    const lang = langSuffix.toLowerCase();
    const languagePriorities: { [key: string]: number } = {
        'eng': 100,
        'en': 100,
        'english': 100,
        'zh': 90,
        'zh-cn': 80,
        'zh-tw': 80,
        'es': 70,
        'fr': 60,
        'de': 50
        // 可以根据需要添加更多语言优先级
    };

    return languagePriorities[lang] || 10;
}

export default class MatchSrt {


    /**
     * 根据视频路径和字幕路径列表，返回匹配的字幕文件列表，按匹配优先级降序排列。
     * 优先匹配同名字幕，带有英语语言后缀的字幕优先。
     *
     * @param videoPath - 视频文件的绝对路径
     * @param srtPaths - 字幕文件的绝对路径列表
     * @returns 匹配的字幕文件路径列表，按优先级降序排列
     */
    public static matchAll(videoPath: string, srtPaths: string[]): string[] {
        // 提取视频文件名（不含扩展名）
        const videoName = extractBaseName(videoPath).toLowerCase();

        const matches: SRTMatch[] = [];

        srtPaths.forEach((srtPath) => {
            const srtBaseName = extractBaseName(srtPath).toLowerCase();

            if (srtBaseName === videoName) {
                // 完全匹配，最低优先级
                matches.push({ path: srtPath, priority: 1 });
            } else if (srtBaseName.startsWith(videoName + '.')) {
                const langSuffix = srtBaseName.substring(videoName.length + 1);
                const langPriority = getLanguagePriority(langSuffix);
                if (langPriority > 0) {
                    matches.push({ path: srtPath, priority: langPriority + 1 });
                }
            }
        });

        // 按优先级降序排序
        matches.sort((a, b) => b.priority - a.priority);

        // 提取排序后的字幕路径
        return matches.map(match => match.path);
    }

    public static matchOne(videoPath: string, srtPaths: string[]): string | null {
        const matches = MatchSrt.matchAll(videoPath, srtPaths);
        return matches.length > 0 ? matches[0] : null;
    }
}
