import { WatchProject } from '@/backend/db/tables/watchProjects';
import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';

export interface WatchProjectListVO extends WatchProject {
    video: WatchProjectVideo;
}

export interface WatchProjectVO extends WatchProject {
    videos: WatchProjectVideo[];
}
