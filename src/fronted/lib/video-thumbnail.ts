import MediaUtil from '@/common/utils/MediaUtil';
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/** 缩略图生成参数。 */
export interface VideoThumbnailParams {
    /** 媒体文件绝对路径。 */
    filePath: string;
    /** 截图时间点，单位为秒。 */
    time: number;
    /** 图片质量档位。 */
    quality?: 'low' | 'medium' | 'high' | 'ultra';
    /** 输出宽度，单位为像素。 */
    width?: number;
    /** 输出格式。 */
    format?: 'jpg' | 'png';
}

/**
 * 请求视频缩略图，纯音频文件直接返回 `null`。
 *
 * 缩略图是「视频画面的一帧」，对没有视频流的文件请求它必然失败：ffmpeg 会报
 * `Output file does not contain any stream`。调用方（swr 或滚动可见性触发）拿到异常后
 * 往往会反复重试，于是变成反复拉起注定失败的 ffmpeg 进程并刷错误日志。
 *
 * 判断统一收口在这里，调用方拿到 `null` 时展示占位图标即可，不必各自再判一次类型。
 * 注意这是「按扩展名判断音频」，与界面其它地方（文件浏览、播放页空态）的判定口径一致。
 *
 * @param params 缩略图生成参数。
 * @returns 缩略图路径；纯音频文件返回 `null`。
 */
export const requestVideoThumbnail = async (params: VideoThumbnailParams): Promise<string | null> => {
    if (MediaUtil.isAudio(params.filePath)) {
        return null;
    }
    return backendClient.call('media/thumbnail', params);
};
