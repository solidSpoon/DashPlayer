import { inArray } from 'drizzle-orm';
import natural from 'natural';
import { p } from '../../common/utils/Util';
import db from '../../db/db';
import { InsertStem, Stem, stems } from '../tables/stems';

export const s = natural.PorterStemmer;
export default class StemLevelService {
    /**
     * 记录词干
     * @param word 原始单词
     * @param familiar 是否熟悉
     */
    public static async recordStem(word: string, familiar: boolean) {
        const stem: InsertStem = {
            stem: p(s.stem(word)),
            familiar,
        };
        await db
            .insert(stems)
            .values(stem)
            .onConflictDoUpdate({
                target: stems.stem,
                set: {
                    familiar: stem.familiar,
                    updated_at: new Date().toISOString(),
                },
            });
    }

    public static tryAddStem(word: string) {
        const stem: InsertStem = {
            stem: p(s.stem(word)),
        };

        return db.insert(stems).values(stem).onConflictDoNothing({
            target: stems.stem,
        });
    }

    public static async queryStems(
        words: string[]
    ): Promise<Map<string, boolean>> {
        if (words.length === 0) {
            return new Map<string, boolean>();
        }
        const result: Stem[] = await db
            .select()
            .from(stems)
            .where(
                inArray(
                    stems.stem,
                    words.map((w) => p(s.stem(w)))
                )
            );
        const map = new Map<string, boolean>();
        result.forEach((item) => {
            map.set(p(item.stem) ?? '', item.familiar ?? false);
        });

        const res = new Map<string, boolean>();
        words.forEach((item) => {
            res.set(item, map.get(p(s.stem(item))) ?? false);
        });

        return res;
    }
}
