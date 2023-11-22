export interface WatchProject {
    id?: number;
    project_name?: string;
    /**
     * 1: 文件
     * 2: 文件夹
     */
    type?: number;
    project_key?: string;
    project_path?: string;
    current_video_id?: number;
    created_at?: string;
    updated_at?: string;
}

export enum WatchProjectType {
    FILE = 1,
    DIRECTORY = 2,
}

export const WATCH_PROJECT_TABLE_NAME = 'dp_watch_project';
