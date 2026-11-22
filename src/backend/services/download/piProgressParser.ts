import type {
    PiDownloadMediaCardInfo,
    PiDownloadPhase,
    PiDownloadProgressInfo,
} from '@/common/contracts/pi-download';

const VALID_PHASES: ReadonlySet<string> = new Set<PiDownloadPhase>([
    'checking_env',
    'analyzing',
    'downloading',
    'postprocessing',
    'completed',
    'error',
]);

/**
 * 解析百分比字符串或数字（仅用于下载器真实输出）。
 */
function parsePercentValue(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
    }
    if (typeof raw === 'string') {
        const cleaned = raw.replace(/%/g, '').trim();
        if (cleaned.length === 0 || cleaned.toUpperCase() === 'N/A') {
            return null;
        }
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.min(100, Math.round(parsed * 10) / 10));
        }
    }
    return null;
}

/**
 * 解析自定义工具 `report_stage` 的调用参数。
 *
 * @param args 工具调用参数对象。
 * @returns 阶段进度信息；参数非法时返回 null。
 */
export function parseReportStageToolArgs(args: unknown): PiDownloadProgressInfo | null {
    if (!args || typeof args !== 'object') {
        return null;
    }
    const { phase, detail } = args as { phase?: unknown; detail?: unknown };
    if (typeof phase !== 'string' || !VALID_PHASES.has(phase)) {
        return null;
    }
    const typedPhase = phase as PiDownloadPhase;
    return {
        phase: typedPhase,
        percent: typedPhase === 'completed' ? 100 : null,
        detail: typeof detail === 'string' && detail.trim().length > 0 ? detail.trim() : undefined,
    };
}

/**
 * 解析自定义工具 `present_video` 的调用参数。
 *
 * @param args 工具调用参数对象。
 * @returns 就绪状态的视频卡片信息；缺少必填字段时返回 null。
 */
export function parsePresentVideoToolArgs(args: unknown): PiDownloadMediaCardInfo | null {
    if (!args || typeof args !== 'object') {
        return null;
    }
    const {
        videoPath,
        title,
        subtitlePath,
        resolution,
        durationText,
    } = args as Record<string, unknown>;

    if (typeof videoPath !== 'string' || videoPath.trim().length === 0) {
        return null;
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
        return null;
    }

    return {
        state: 'ready',
        title: title.trim(),
        videoPath: videoPath.trim(),
        subtitlePath: typeof subtitlePath === 'string' && subtitlePath.trim().length > 0
            ? subtitlePath.trim()
            : undefined,
        resolution: typeof resolution === 'string' && resolution.trim().length > 0
            ? resolution.trim()
            : undefined,
        durationText: typeof durationText === 'string' && durationText.trim().length > 0
            ? durationText.trim()
            : undefined,
    };
}

/**
 * 从下载工具（如 yt-dlp / ffmpeg）的终端输出行中解析真实进度。
 *
 * @param line 终端单行输出。
 * @returns 真实下载进度或阶段信息；无进度语义时返回 null。
 */
export function parseToolProgressLine(line: string): PiDownloadProgressInfo | null {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
        return null;
    }

    // 标准 yt-dlp 下载百分比：[download]  42.3% of ~120.5MiB at  4.21MiB/s ETA 00:18
    const ytDlpPercentMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%(?:\s+of\s+(\S+))?(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/i);
    if (ytDlpPercentMatch) {
        const percent = parsePercentValue(ytDlpPercentMatch[1]);
        const parts: string[] = [];
        if (ytDlpPercentMatch[2]) {
            parts.push(ytDlpPercentMatch[2]);
        }
        if (ytDlpPercentMatch[3]) {
            parts.push(ytDlpPercentMatch[3]);
        }
        if (ytDlpPercentMatch[4]) {
            parts.push(`ETA ${ytDlpPercentMatch[4]}`);
        }
        return {
            phase: 'downloading',
            percent,
            detail: parts.length > 0 ? parts.join(' · ') : undefined,
        };
    }

    if (/^\[(?:Merger|ExtractAudio|VideoConvertor|SubtitlesConvertor|EmbedThumbnail)\]/i.test(trimmed)) {
        return {
            phase: 'postprocessing',
            percent: null,
            detail: '正在合并或后处理媒体文件...',
        };
    }

    if (/^\[(?:youtube|bilibili|generic)\]\s+Extracting URL:/i.test(trimmed)) {
        return {
            phase: 'analyzing',
            percent: null,
            detail: '正在解析媒体资源信息...',
        };
    }

    return null;
}

/**
 * 从多行终端输出块中提取最新一条真实工具进度。
 * @param text 累积或多行终端输出。
 * @returns 最新一条进度信息；未命中返回 null。
 */
export function parseLatestToolProgressFromChunk(text: string): PiDownloadProgressInfo | null {
    const lines = text.split(/[\r\n]+/);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const parsed = parseToolProgressLine(lines[i]);
        if (parsed) {
            return parsed;
        }
    }
    return null;
}
