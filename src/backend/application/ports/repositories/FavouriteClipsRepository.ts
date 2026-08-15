import { ClipQuery } from '@/common/api/dto';

import { InsertVideoClip } from '@/backend/infrastructure/db/tables/videoClip';
import { Tag } from '@/common/contracts/tag';

export type FavouriteClipsUpsertClipParams = Pick<InsertVideoClip, 'key' | 'video_name' | 'srt_clip' | 'srt_context' | 'created_at' | 'updated_at'>;

export type FavouriteClipsReplaceAllItem = {
    clip: FavouriteClipsUpsertClipParams;
    tags: string[];
};

export default interface FavouriteClipsRepository {
    listExistingClipKeys(keys: string[]): Promise<string[]>;
    existsClipKey(key: string): Promise<boolean>;
    saveClipWithTags(values: FavouriteClipsUpsertClipParams, tagNames: string[]): Promise<void>;
    replaceAll(clips: FavouriteClipsReplaceAllItem[]): Promise<void>;
    deleteClipAndPruneTags(clipKey: string): Promise<void>;
    searchClipKeys(query?: ClipQuery): Promise<string[]>;
    listTagsByClipKey(clipKey: string): Promise<Tag[]>;
    ensureTag(name: string): Promise<Tag>;
    deleteTagById(tagId: number): Promise<void>;
    updateTagName(tagId: number, name: string): Promise<void>;
    searchTagsByPrefix(keyword: string): Promise<Tag[]>;
    insertClipTagIgnore(clipKey: string, tagId: number): Promise<void>;
    deleteClipTagAndPruneTag(clipKey: string, tagId: number): Promise<void>;
    listClipKeysByTagId(tagId: number): Promise<string[]>;
}
