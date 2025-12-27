import { eq, inArray, sql } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/db';
import { InsertVideoLearningClipWord, videoLearningClipWord } from '@/backend/db/tables/videoLearningClipWord';

import VideoLearningClipWordRepository from '@/backend/db/repositories/VideoLearningClipWordRepository';

@injectable()
export default class VideoLearningClipWordRepositoryImpl implements VideoLearningClipWordRepository {

    public async findClipKeysByWord(word: string): Promise<string[]> {
        if (!word) {
            return [];
        }

        const rows = await db
            .select({ clip_key: videoLearningClipWord.clip_key })
            .from(videoLearningClipWord)
            .where(eq(videoLearningClipWord.word, word));

        return rows.map((row) => row.clip_key);
    }

    public async getWordsMapByClipKeys(keys: string[]): Promise<Map<string, string[]>> {
        const result = new Map<string, string[]>();
        if (!keys || keys.length === 0) {
            return result;
        }

        const rows = await db
            .select({
                clipKey: videoLearningClipWord.clip_key,
                word: videoLearningClipWord.word,
            })
            .from(videoLearningClipWord)
            .where(inArray(videoLearningClipWord.clip_key, keys));

        const tempMap = new Map<string, Set<string>>();
        for (const row of rows) {
            const cleanedWord = typeof row.word === 'string' ? row.word.toLowerCase().trim() : '';
            if (!cleanedWord) {
                continue;
            }
            if (!tempMap.has(row.clipKey)) {
                tempMap.set(row.clipKey, new Set());
            }
            tempMap.get(row.clipKey)?.add(cleanedWord);
        }

        tempMap.forEach((set, key) => {
            result.set(key, Array.from(set));
        });

        return result;
    }

    public async insertManyIgnoreDuplicates(values: InsertVideoLearningClipWord[]): Promise<void> {
        if (!values || values.length === 0) {
            return;
        }

        await db.insert(videoLearningClipWord).values(values).onConflictDoNothing();
    }

    public async deleteAll(): Promise<void> {
        await db.delete(videoLearningClipWord).where(sql`1=1`);
    }

    public async countGroupedByWord(): Promise<Record<string, number>> {
        const rows = await db
            .select({
                word: videoLearningClipWord.word,
                count: sql<number>`count(*)`,
            })
            .from(videoLearningClipWord)
            .groupBy(videoLearningClipWord.word);

        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.word] = Number(row.count) || 0;
        }
        return result;
    }
}

