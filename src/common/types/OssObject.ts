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
     * 对应字幕文件的片段
     */
    'srt_clip': string;
    /**
     * 字幕文件中台词部分（不包括时间）
     */
    'srt_str': string;
}
export interface OssObject extends MetaData {
    clipPath: string;
    thumbnailPath: string;
    key: string;
}
