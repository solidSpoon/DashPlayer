import path from 'path';

import { WatchHistoryRecord } from '@/backend/application/ports/repositories/WatchHistoryRepository';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';

/**
 * 判断文件名是否为 HTML5 视频变体。
 *
 * @param fileName 待判断的文件名。
 * @returns 文件名以 `.html5.mp4` 结尾时返回 `true`。
 */
export function isHtml5VariantFileName(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.html5.mp4');
}

/**
 * 获取视频对应的 HTML5 变体路径。
 *
 * @param filePath 视频文件路径。
 * @returns 对应的 `.html5.mp4` 路径；传入 HTML5 变体时返回原路径。
 */
export function getHtml5VariantPath(filePath: string): string {
    const parsed = path.parse(filePath);
    if (isHtml5VariantFileName(parsed.base)) {
        return filePath;
    }

    const baseName = removeHtml5Suffix(parsed.name);
    return path.join(parsed.dir, `${baseName}.html5.mp4`);
}

/**
 * 移除文件名中的 `.html5` 后缀。
 *
 * @param fileName 不包含扩展名的文件名。
 * @returns 移除后缀后的文件名。
 */
function removeHtml5Suffix(fileName: string): string {
    return fileName.toLowerCase().endsWith('.html5')
        ? fileName.slice(0, -'.html5'.length)
        : fileName;
}

/**
 * 获取观看历史记录对应的 HTML5 变体路径。
 *
 * @param record 观看历史数据库记录。
 * @returns 记录对应的 `.html5.mp4` 路径。
 */
export function getHtml5VariantPathFromRecord(record: WatchHistoryRecord): string {
    return getHtml5VariantPath(path.join(record.base_path, record.file_name));
}

/**
 * 为视频记录生成 HTML5 变体分组键。
 *
 * @param basePath 视频所在目录。
 * @param fileName 视频文件名。
 * @returns 同一视频不同格式变体共用的分组键。
 */
export function getHtml5GroupKey(basePath: string, fileName: string): string {
    const extension = path.extname(fileName);
    const baseName = removeHtml5Suffix(path.basename(fileName, extension));
    return `${basePath}::${baseName.toLowerCase()}`;
}

/**
 * 将 HTML5 视频变体合并成一个展示项。
 *
 * HTML5 文件作为实际播放目标保留；如果同组存在原始视频，则用原始文件名作为展示名。
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
