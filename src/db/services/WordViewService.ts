import { p } from '../../utils/Util';
import db from 'db/db';

import { eq, inArray, sql } from 'drizzle-orm';
import { InsertWord, words } from '../tables/words';
import { InsertStem, stems } from '../tables/stems';
import { WordView } from '../tables/wordView';

export interface Pagination<T> {
    total: number;
    perPage: number;
    offset: number;
    to: number;
    lastPage: number;
    currentPage: number;
    from: number;
    data: T[];
}

export default class WordViewService {

    private static wordView = db.select({
        word: words.word,
        translate: words.translate,
        stem: words.stem,
        note: words.note,
        familiar: stems.familiar
    })
        .from(words)
        .leftJoin(stems, eq(words.stem, stems.stem))
        .as('wordView');

    public static async queryWords(
        words: string[]
    ): Promise<Map<string, WordView>> {
        // eslint-disable-next-line no-param-reassign
        words = words.map((w) => p(w));
        if (words.length === 0) {
            return new Map<string, WordView>();
        }
        const result = await db
            .select()
            .from(this.wordView)
            .where(inArray(this.wordView.word, words));
        const map = new Map<string, WordView>();
        result.forEach((item) => {
            map.set(p(item.word) ?? '', item);
        });
        return map;
    }

    static async list(
        whereSql: string,
        orderBySql: string,
        perPage: number,
        currentPage: number
    ): Promise<Pagination<WordView>> {
        if (whereSql.trim() === '') {
            // eslint-disable-next-line no-param-reassign
            whereSql = '1 = 1';
        }
        if (orderBySql.trim() === '') {
            // eslint-disable-next-line no-param-reassign
            orderBySql = 'word';
        }
        console.log('list', whereSql, orderBySql, perPage, currentPage);
        const offset = (currentPage - 1) * perPage;


        const [total, rows]: [{ count: number }[], WordView[]] = await Promise.all([
            db.select({
                count: sql<number>`cast(count(1) as int)`
            })
                .from(this.wordView),

            db
                .select()
                .from(this.wordView)
                .where(sql`${whereSql}`)
                .orderBy(sql`${orderBySql}`)
                .offset(offset)
                .limit(perPage)
        ]);
        const count = (total[0] as any).count;
        const pagination: Pagination<WordView> = {
            total: count,
            perPage,
            offset,
            to: offset + rows.length,
            lastPage: Math.ceil(count / perPage),
            currentPage,
            from: offset,
            data: rows
        };
        return pagination;
    }

    static async batchUpdate(views: WordView[]) {
        const wordsToUpdate = views.map((item) => ({
            word: p(item.word),
            translate: item.translate,
            stem: item.stem,
            note: item.note
        } as InsertWord));

        const stemsToUpdate = views.map((item) => ({
            stem: item.stem,
            familiar: item.familiar
        } as InsertStem));

        for (const item of wordsToUpdate) {
            await db
                .insert(words)
                .values({
                    word: p(item.word ?? ''),
                    translate: item.translate,
                    stem: item.stem,
                    note: item.note
                })
                .onConflictDoUpdate({
                    target: words.word,
                    set: {
                        translate: item.translate,
                        stem: item.stem,
                        note: item.note
                    }
                });
        }

        for (const item of stemsToUpdate) {
            await db
                .insert(stems)
                .values({
                    stem: item.stem,
                    familiar: item.familiar
                })
                .onConflictDoUpdate({
                    target: stems.stem,
                    set: {
                        familiar: item.familiar
                    }
                });
        }
    }
}
