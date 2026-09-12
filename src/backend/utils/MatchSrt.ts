import path from 'path';
import leven from 'leven';
import StrUtil from '@/common/utils/str-util';

/**
 * 字幕命中方式。
 *
 * - `exact-name`：与视频同名（无语言后缀）；
 * - `lang-suffix`：视频名 + 语言后缀；
 * - `fuzzy`：编辑距离模糊兜底。
 */
export type SrtMatchKind = 'exact-name' | 'lang-suffix' | 'fuzzy';

/** 单个字幕的匹配详情，用于判断字幕是否可能挂错。 */
export interface SrtMatchDetail {
    /** 命中的字幕文件路径。 */
    path: string;
    /** 命中方式。 */
    kind: SrtMatchKind;
    /** 模糊兜底命中且文件名与视频存疑时为 true，可能是别的视频的字幕。 */
    suspicious: boolean;
}

type SRTMatch = {
    path: string;
    langSuffix: string | null;
    priority: number;
    kind: SrtMatchKind;
};

/** 季集编号；仅从 S01E02 / 1x02 等强格式提取。 */
interface EpisodeCode {
    season: number;
    episode: number;
}

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

/**
 * 剥离分辨率噪声（1920x1080、720p 等）后得到仅小写字母数字的规范化名称。
 *
 * 分辨率标记既不是内容标识，又会干扰季集编号提取，比较前先移除。
 *
 * @param baseName 字幕或视频的文件基名（不含扩展名）。
 * @returns 规范化名称。
 */
function normalizeForComparison(baseName: string): string {
    return baseName
        .toLowerCase()
        .replace(/\d{3,4}x\d{3,4}/g, '')
        .replace(/\d{3,4}p/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * 从文件基名提取季集编号，兼容 S01E02 / s1e2 / 1x02 等强格式。
 *
 * 数字超出常见季集范围（季 1-99、集 1-999）时视为噪声（如年份、分辨率），返回 `null`。
 * 弱格式（裸 E02 等）容易误匹配单词与数字的组合，刻意不提取。
 *
 * @param baseName 字幕或视频的文件基名（不含扩展名）。
 * @returns 季集编号；无法可靠提取时返回 `null`。
 */
function extractEpisodeCode(baseName: string): EpisodeCode | null {
    const normalized = normalizeForComparison(baseName);
    const sxe = normalized.match(/s(\d{1,2})e(\d{1,3})/);
    if (sxe) {
        return { season: Number(sxe[1]), episode: Number(sxe[2]) };
    }
    const xxe = normalized.match(/(\d{1,2})x(\d{1,3})/);
    if (xxe) {
        return { season: Number(xxe[1]), episode: Number(xxe[2]) };
    }
    return null;
}

/**
 * 判断模糊兜底命中的字幕文件名是否与视频存疑。规则偏保守，宁可漏报不误报：
 *
 * - 双方都能提取季集编号：编号一致视为同一集的命名变体（不可疑），不一致才可疑；
 * - 任一方无法提取编号：剥离分辨率噪声后，规范化名称互不包含才可疑
 *   （同一发行版的命名变体，如 `Movie.Name` 与 `Movie.Name.1080p`，通常互相包含）。
 *
 * @param videoName 视频文件基名（不含扩展名）。
 * @param srtName 字幕文件基名（不含扩展名）。
 * @returns 是否疑似挂错了别的视频的字幕。
 */
function isSuspiciousFuzzyPair(videoName: string, srtName: string): boolean {
    const videoCode = extractEpisodeCode(videoName);
    const srtCode = extractEpisodeCode(srtName);
    if (videoCode && srtCode) {
        return videoCode.season !== srtCode.season || videoCode.episode !== srtCode.episode;
    }
    const normalizedVideo = normalizeForComparison(videoName);
    const normalizedSrt = normalizeForComparison(srtName);
    if (StrUtil.isBlank(normalizedVideo) || StrUtil.isBlank(normalizedSrt)) {
        return false;
    }
    return !(normalizedVideo.includes(normalizedSrt) || normalizedSrt.includes(normalizedVideo));
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
     * 计算全部候选字幕的匹配详情（含命中方式），按匹配优先级降序排列。
     *
     * 排序规则：先比语言档位（英语优先），再比格式（srt > vtt > ass）；
     * 模糊匹配时语言档位均为默认档，此时先比名称相似度（priority），再比格式。
     *
     * @param videoPath - 视频文件的绝对路径。
     * @param srtPaths - 字幕文件的绝对路径列表。
     * @returns 匹配详情列表，按优先级降序排列。
     */
    private static matchAllDetails(videoPath: string, srtPaths: string[]): SRTMatch[] {
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
                matches.push({ path: srtPath, langSuffix: null, priority: 1, kind: 'exact-name' });
            } else {
                for (const videoName of videoNames) {
                    if (srtBaseName.startsWith(videoName + '.')) {
                        const langSuffix = srtBaseName.substring(videoName.length + 1);
                        const langPriority = getLanguagePriority(langSuffix);
                        if (langPriority > 0) {
                            matches.push({ path: srtPath, langSuffix, priority: langPriority + 1, kind: 'lang-suffix' });
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
                matches.push({ path: srtPath, langSuffix: null, priority: 1000 - distance, kind: 'fuzzy' });
            });
        }
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
        return matches;
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
        return MatchSrt.matchAllDetails(videoPath, srtPaths).map(match => match.path);
    }

    /**
     * 返回最优字幕匹配的详情，包括命中方式与模糊兜底命中的可疑标记。
     *
     * 同名与语言后缀命中视为可信（`suspicious` 恒为 false）；只有模糊兜底命中才做保守的
     * 名称存疑判定，供前端引导用户重新生成字幕。
     *
     * @param videoPath - 视频文件的绝对路径
     * @param srtPaths - 字幕文件的绝对路径列表
     * @returns 最优匹配详情；无候选时返回 `null`
     */
    public static matchOneDetail(videoPath: string, srtPaths: string[]): SrtMatchDetail | null {
        const matches = MatchSrt.matchAllDetails(videoPath, srtPaths);
        if (matches.length === 0) {
            return null;
        }
        const best = matches[0];
        const referenceVideoName = MatchSrt.videoNameCandidates(videoPath).pop()
            ?? extractBaseName(videoPath);
        return {
            path: best.path,
            kind: best.kind,
            suspicious: best.kind === 'fuzzy' && isSuspiciousFuzzyPair(referenceVideoName, extractBaseName(best.path)),
        };
    }
}
