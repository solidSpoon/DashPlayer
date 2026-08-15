/**
 * 文件夹内等待转换的视频集合。
 */
export interface FolderVideos {
    /** 被扫描的文件夹绝对路径。 */
    folder: string;
    /** 尚未生成 HTML5 MP4 文件的 MKV 视频绝对路径。 */
    videos: string[];
}

/**
 * 转换任务向渲染端暴露的进度结果。
 */
export interface ConvertResult {
    /** 当前转换进度，取值范围为 0 到 100。 */
    progress: number;
    /** 转换生成的 HTML5 MP4 文件绝对路径。 */
    path: string;
}
