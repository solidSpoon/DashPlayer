export interface WatchProjectVideo {
    id?: number;
    project_id?: number;
    video_name?: string;
    video_path?: string;
    subtitle_path?: string;
    current_time?: number;
    duration?: number;
    current_playing?: number;
    created_at?: string;
    updated_at?: string;
}

export const WATCH_PROJECT_VIDEO_TABLE_NAME = 'dp_watch_project_video';
