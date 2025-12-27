import { InsertVideoLearningClip, VideoLearningClip } from '@/backend/infrastructure/db/tables/videoLearningClip';

export interface VideoLearningClipPageQuery {
    keys?: string[];
    offset: number;
    limit: number;
}

export interface VideoLearningClipCountQuery {
    keys?: string[];
}

export default interface VideoLearningClipRepository {
    findExistingKeys(keys: string[]): Promise<Set<string>>;
    count(query?: VideoLearningClipCountQuery): Promise<number>;
    listPage(query: VideoLearningClipPageQuery): Promise<VideoLearningClip[]>;
    exists(key: string): Promise<boolean>;
    upsert(values: InsertVideoLearningClip): Promise<void>;
    deleteByKey(key: string): Promise<void>;
    deleteAll(): Promise<void>;
}

