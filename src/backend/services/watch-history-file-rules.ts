import path from 'path';

import { WatchHistoryRecord } from '@/backend/services/repositories/WatchHistoryRepository';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import MediaUtil from '@/common/utils/MediaUtil';

/** 修复产物在文件名中的固定中缀。 */
const HTML5_SUFFIX = '.html5';

/** 修复产物写入过程中的临时后缀。 */
const PART_SUFFIX = '.part';

/**
 * 判断文件名是否为修复产物。
 *
 * 产物命名规则为「原文件名 + `.html5` + 容器后缀」，例如 `a.mp3` → `a.html5.m4a`、
 * `b.mkv` → `b.html5.mp4`。
 *
 * @param fileName 待判断的文件名。
 * @returns 主文件名以 `.html5` 结尾时返回 `true`。
 */
export function isHtml5VariantFileName(fileName: string): boolean {
    const extension = path.extname(fileName);
    if (extension === '') {
        return false;
    }
    return path.basename(fileName, extension).toLowerCase().endsWith(HTML5_SUFFIX);
}

/**
 * 获取媒体文件对应的修复产物路径。
 *
 * 产物与源文件同目录：音频文件用 `.m4a` 容器，其余一律用 `.mp4`，
 * 这样产物的媒体类型与源文件一致（音频不会被当成视频）。
 *
 * @param filePath 媒体文件路径。
 * @returns 对应的修复产物路径；传入产物路径时原样返回。
 */
export function getHtml5VariantPath(filePath: string): string {
    const parsed = path.parse(filePath);
    if (isHtml5VariantFileName(parsed.base)) {
        return filePath;
    }

    const baseName = removeHtml5Suffix(parsed.name);
    const extension = MediaUtil.isAudio(parsed.base) ? '.m4a' : '.mp4';
    return path.join(parsed.dir, `${baseName}${HTML5_SUFFIX}${extension}`);
}

/**
 * 获取修复产物在写入过程中的临时路径。
 *
 * 产物先落到临时名，写完并通过校验后才改名为正式产物名。原因是正式产物名一旦出现，
 * 就会被「有修复产物就优先用产物」的播放与元数据探测逻辑选中，而 mp4 系容器在写完
 * moov 之前无法解析：ffprobe 报 `moov atom not found`、播放器报
 * `DEMUXER_ERROR_COULD_NOT_OPEN`，于是正在播放的媒体和观看历史列表会一起失败。
 *
 * 临时名以 `.part` 结尾、不带媒体扩展名，因此文件夹扫描与字幕匹配都不会把它当作媒体。
 *
 * @param outputPath 最终产物绝对路径。
 * @returns 同目录下的临时文件绝对路径。
 */
export function getRepairTempPath(outputPath: string): string {
    return `${outputPath}${PART_SUFFIX}`;
}

/**
 * 移除文件名中的 `.html5` 后缀。
 *
 * @param fileName 不包含扩展名的文件名。
 * @returns 移除后缀后的文件名。
 */
function removeHtml5Suffix(fileName: string): string {
    return fileName.toLowerCase().endsWith(HTML5_SUFFIX)
        ? fileName.slice(0, -HTML5_SUFFIX.length)
        : fileName;
}

/**
 * 获取观看历史记录对应的 HTML5 变体路径。
 *
 * @param record 观看历史数据库记录。
 * @returns 记录对应的修复产物路径。
 */
export function getHtml5VariantPathFromRecord(record: WatchHistoryRecord): string {
    return getHtml5VariantPath(path.join(record.base_path, record.file_name));
}

/**
 * 为媒体记录生成修复产物分组键。
 *
 * @param basePath 媒体所在目录。
 * @param fileName 媒体文件名。
 * @returns 同一媒体不同版本共用的分组键。
 */
export function getHtml5GroupKey(basePath: string, fileName: string): string {
    const extension = path.extname(fileName);
    const baseName = removeHtml5Suffix(path.basename(fileName, extension));
    return `${basePath}::${baseName.toLowerCase()}`;
}

/**
 * 将修复产物合并成一个展示项。
 *
 * 产物作为实际播放目标保留；如果同组存在原始文件，则用原始文件名作为展示名。
 *
 * @param items 待合并的观看历史展示项。
 * @returns 合并后的展示项列表。
 */
export function mergeHtml5Variants(items: WatchHistoryVO[]): WatchHistoryVO[] {
    const groups = new Map<string, WatchHistoryVO[]>();
    for (const item of items) {
        const key = item.isFolder
            ? `${item.id}::folder`
            : getHtml5GroupKey(item.basePath, item.fileName);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return [...groups.values()].map((group) => {
        if (group.length === 1 || group[0].isFolder) {
            return group[0];
        }

        const primary = group.find((item) => isHtml5VariantFileName(item.fileName)) ?? group[0];
        return {
            ...primary,
            displayFileName: getDisplayFileName(group, primary),
        };
    });
}

/**
 * 选择 HTML5 变体的展示文件名。
 *
 * @param group 同一视频的所有文件变体。
 * @param primary 实际保留的主展示项。
 * @returns 用于列表展示的文件名。
 */
function getDisplayFileName(group: WatchHistoryVO[], primary: WatchHistoryVO): string {
    if (!isHtml5VariantFileName(primary.fileName)) {
        return primary.fileName;
    }

    return group.find((item) => item.fileName.toLowerCase().endsWith('.mkv'))?.fileName
        ?? group.find((item) => !isHtml5VariantFileName(item.fileName))?.fileName
        ?? primary.fileName;
}
