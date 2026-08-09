import path from 'path';
import leven from 'leven';
import StrUtil from '@/common/utils/str-util';

type SRTMatch = {
    path: string;
    langSuffix: string | null;
    priority: number;
};

function extractBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

function subtitleFormatRank(filePath: string): number {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.srt') return 0;
    if (ext === '.vtt') return 1;
    if (ext === '.ass') return 2;
    return 3;
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

/**
 * 语言匹配档位（数值越大越优先）：
 * 5 = 显式英语；4 = 无语言后缀的纯同名（默认为主字幕）；3 = 中文；
 * 2 = 其它已知语言；1 = 未知语言后缀。
 * 英语学习场景下，显式英语字幕与纯同名主字幕均优先于中文。
 */
function languageTier(langSuffix: string | null): number {
    if (langSuffix === null) {
        return 4;
    }
    const lang = langSuffix.toLowerCase();
    if (lang === 'eng' || lang === 'en' || lang === 'english') {
        return 5;
    }
    if (lang === 'zh' || lang === 'zh-cn' || lang === 'zh-tw') {
        return 3;
    }
    if (['es', 'fr', 'de', 'ja', 'ko', 'ru'].includes(lang)) {
        return 2;
    }
    return 1;
}

export default class MatchSrt {

    private static videoNameCandidates(videoPath: string): string[] {
        const raw = extractBaseName(videoPath).toLowerCase();
        const candidates: string[] = [raw];
        if (raw.endsWith('.html5')) {
            const stripped = raw.slice(0, -'.html5'.length);
            if (StrUtil.isNotBlank(stripped)) {
                candidates.push(stripped);
            }
        }
        return Array.from(new Set(candidates));
    }

    /**
     * 根据视频路径和字幕路径列表，返回匹配的字幕文件列表，按匹配优先级降序排列。
     * 英语学习场景：优先显式英语（eng/en/english）字幕，其次无语言后缀的纯同名主字幕，
     * 再次中文，最后其它语言；同档内按格式 srt > vtt > ass。
     *
     * @param videoPath - 视频文件的绝对路径
     * @param srtPaths - 字幕文件的绝对路径列表
     * @returns 匹配的字幕文件路径列表，按优先级降序排列
     */
    public static matchAll(videoPath: string, srtPaths: string[]): string[] {
        if (srtPaths?.length === 0 || StrUtil.isBlank(videoPath)) {
            return [];
        }
        const videoNames = MatchSrt.videoNameCandidates(videoPath);

        const matches: SRTMatch[] = [];
        let usedFuzzyMatch = false;

        srtPaths.forEach((srtPath) => {
            const srtBaseName = extractBaseName(srtPath).toLowerCase();

            if (videoNames.some((n) => srtBaseName === n)) {
                // 完全同名（无语言后缀），作为默认主字幕参与语言档位排序
                matches.push({ path: srtPath, langSuffix: null, priority: 1 });
            } else {
                for (const videoName of videoNames) {
                    if (srtBaseName.startsWith(videoName + '.')) {
                        const langSuffix = srtBaseName.substring(videoName.length + 1);
                        const langPriority = getLanguagePriority(langSuffix);
                        if (langPriority > 0) {
                            matches.push({ path: srtPath, langSuffix, priority: langPriority + 1 });
                        }
                        break;
                    }
                }
            }
        });
        if (matches.length === 0) {
            usedFuzzyMatch = true;
            const baseName = videoNames[videoNames.length - 1] ?? extractBaseName(videoPath).toLowerCase();
            srtPaths.forEach((srtPath) => {
                const distance = leven(baseName, extractBaseName(srtPath).toLowerCase());
                matches.push({ path: srtPath, langSuffix: null, priority: 1000 - distance });
            });
        }
        // 排序：先比语言档位（英语优先），再比格式（srt > vtt > ass）。
        // 模糊匹配时语言档位均为默认档，此时先比名称相似度（priority），再比格式。
        matches.sort((a, b) => {
            const tierDiff = languageTier(b.langSuffix) - languageTier(a.langSuffix);
            if (tierDiff !== 0) {
                return tierDiff;
            }
            if (usedFuzzyMatch && (a.priority ?? 0) !== (b.priority ?? 0)) {
                return (b.priority ?? 0) - (a.priority ?? 0);
            }
            const ar = subtitleFormatRank(a.path);
            const br = subtitleFormatRank(b.path);
            if (ar !== br) {
                return ar - br;
            }
            return (b.priority ?? 0) - (a.priority ?? 0);
        });
        // 提取排序后的字幕路径
        return matches.map(match => match.path);
    }

    public static matchOne(videoPath: string, srtPaths: string[]): string | null {
        const matches = MatchSrt.matchAll(videoPath, srtPaths);
        return matches.length > 0 ? matches[0] : null;
    }
}
