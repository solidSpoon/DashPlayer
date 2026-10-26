/**
 * 手机版页面使用的最近播放条目。
 *
 * 只包含列表展示需要的字段，不暴露本机绝对路径。
 */
export interface MobileRecentItem {
    /** 观看记录 ID，手机页用它拉取播放详情。 */
    id: string;
    /** 主标题：普通视频取文件名，目录记录取目录名。 */
    title: string;
    /** 副标题：普通视频取所在目录名，目录记录取最近播放的文件名。 */
    subtitle: string;
    /** 是否为目录集合记录。 */
    isFolder: boolean;
    /** 是否为纯音频。 */
    isAudio: boolean;
    /** 最近播放时间，ISO 8601 字符串。 */
    updatedAt: string;
    /** 上次播放到的位置，单位秒。 */
    position: number;
    /** 列表大图地址；纯音频不使用该地址。 */
    thumbnailUrl: string;
}

/**
 * 手机版字幕行。
 */
export interface MobileSubtitleLine {
    /** 开始时间，已应用用户在桌面端做过的字幕时间轴调整，单位秒。 */
    start: number;
    /** 结束时间，已应用时间轴调整，单位秒。 */
    end: number;
    /** 英文字幕原文。 */
    en: string;
    /** 字幕文件自带的中文原文；没有时为空字符串。 */
    zh: string;
}

/**
 * 手机版播放详情。
 */
export interface MobileWatchDetail {
    /** 观看记录 ID。 */
    id: string;
    /** 主标题。 */
    title: string;
    /** 副标题。 */
    subtitle: string;
    /** 是否为纯音频。 */
    isAudio: boolean;
    /** 视频流地址，支持 Range 请求。 */
    streamUrl: string;
    /** 上次播放位置，单位秒。 */
    currentPosition: number;
    /** 字幕行；没有匹配到字幕时为空数组。 */
    subtitles: MobileSubtitleLine[];
    /** 字幕与视频疑似不匹配，用于页面提示。 */
    subtitleMismatchSuspected: boolean;
}
