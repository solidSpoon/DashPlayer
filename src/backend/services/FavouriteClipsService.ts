import { Tag } from '@/backend/infrastructure/db/tables/tag';
import { ClipQuery } from '@/common/api/dto';
import { ClipMeta, OssBaseMeta } from '@/common/types/clipMeta';

/**
 * FavouriteClipsService
 */
export interface FavouriteClipsService {

    taskInfo(): number;

    /**
     * Adds a clip to the favorites.
     * @param videoPath - The path to the video file.
     * @param srtKey - The key of the subtitle file.
     * @param indexInSrt - The index of the clip in the subtitle file.
     * @returns A promise that resolves to the ID of the added clip.
     */
    addClip(videoPath: string, srtKey: string, indexInSrt: number): Promise<void>;

    /**
     * Cancels the addition of a clip to the favorites.
     * @param srtKey - The key of the subtitle file.
     * @param indexInSrt - The index of the clip in the subtitle file.
     * @returns A promise that resolves when the operation is complete.
     */
    cancelAddClip(srtKey: string, indexInSrt: number): Promise<void>;

    /**
     * Deletes a favorite clip.
     * @param key - The key of the clip to delete.
     * @returns A promise that resolves when the operation is complete.
     */
    deleteFavoriteClip(key: string): Promise<void>;

    /**
     * Queries the tags associated with a clip.
     * @param key - The key of the clip.
     * @returns A promise that resolves to an array of tags.
     */
    queryClipTags(key: string): Promise<Tag[]>;

    /**
     * Adds a tag to a clip.
     * @param key - The key of the clip.
     * @param tagId - The ID of the tag to add.
     * @returns A promise that resolves when the operation is complete.
     */
    addClipTag(key: string, tagId: number): Promise<void>;

    /**
     * Deletes a tag from a clip.
     * @param key - The key of the clip.
     * @param tagId - The ID of the tag to delete.
     * @returns A promise that resolves when the operation is complete.
     */
    deleteClipTag(key: string, tagId: number): Promise<void>;

    // rename tag
    /**
     * Renames a tag.
     * @param tagId - The ID of the tag to rename.
     * @param newName - The new name of the tag.
     */
    renameTag(tagId: number, newName: string): Promise<void>;

    /**
     * Searches for clips based on a query.
     * @param query - The query parameters.
     * @returns A promise that resolves to an array of OssObject.
     */
    search(query?: ClipQuery): Promise<(OssBaseMeta & ClipMeta)[]>;

    /**
     * Checks if clips exist in the favorites.
     * @param srtKey - The key of the subtitle file.
     * @param linesInSrt - An array of line indices in the subtitle file.
     * @returns A promise that resolves to a map of line indices to boolean values indicating existence.
     */
    exists(srtKey: string, linesInSrt: number[]): Promise<Map<number, boolean>>;

    syncFromOss(): Promise<void>;
}
