import { InsertVideoLearningClip, VideoLearningClip } from '@/backend/infrastructure/db/tables/videoLearningClip';
import { InsertVideoLearningClipWord } from '@/backend/infrastructure/db/tables/videoLearningClipWord';

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
    saveClipWithWords(clip: InsertVideoLearningClip, words: InsertVideoLearningClipWord[]): Promise<void>;
    /**
     * 原子地删除一个片段及其全部单词关联。
     *
     * @param key 片段键。
     */
    deleteClipWithWords(key: string): Promise<void>;
    replaceAll(clips: InsertVideoLearningClip[], words: InsertVideoLearningClipWord[]): Promise<void>;
}
