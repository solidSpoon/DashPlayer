import { ClipSrtLine } from '@/common/types/clipMeta';
import { Sentence } from '@/fronted/hooks/usePlayerV2';
import UrlUtil from '@/common/utils/UrlUtil';

export function convertFavoriteClipToSentences(
    clipSrtLines: ClipSrtLine[],
    videoPath: string,
    clipKey: string
): Sentence[] {
    return clipSrtLines.map((line, index) => ({
        index,
        start: line.begin / 1000, // Convert ms to seconds
        end: line.end / 1000, // Convert ms to seconds
        text: line.contentEn,
        translation: line.contentZh,
        fileHash: clipKey,
        filePath: videoPath,
        // Map existing ClipSrtLine properties to Sentence format
        raw: {
            contentEn: line.contentEn,
            contentZh: line.contentZh,
            begin: line.begin,
            end: line.end,
            index: line.index
        }
    }));
}

export function getFavoriteVideoUrl(playInfo: any): string {
    if (!playInfo?.video) return '';
    return UrlUtil.file(playInfo.video.baseDir, playInfo.video.clip_file);
}

export function getFavoriteInitialTime(playInfo: any): number {
    return playInfo?.time || 0;
}