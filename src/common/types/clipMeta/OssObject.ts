export type ClipSrtLine = {
    index: number;
    start: number;
    end: number;
    contentEn: string;
    contentZh: string;
    isClip: boolean;
}
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
    'clip_content': ClipSrtLine[];
    'clip_file': string;
    'thumbnail_file': string;
    'tags': string[];
}
export interface OssObject  {
    key: string;
    baseDir: string;
}

export type ClipMeta = MetaData & OssObject;
