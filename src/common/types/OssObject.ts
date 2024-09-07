export interface MetaData {
    'key': string;
    /**
     * 视频名
     */
    'video_name': string;
    /**
     * 创建时间
     */
    'created_at': number;
    'start_time': number,
    'end_time': number,
    /**
     * 收藏的行
     */
    'srt_clip': string;
    'srt_clip_with_time': string;
    /**
     * 周围的字幕
     */
    'srt_context': string;
    'srt_context_with_time': string;
}
export interface OssObject extends MetaData {
    clipPath: string;
    thumbnailPath: string;
    key: string;
}
