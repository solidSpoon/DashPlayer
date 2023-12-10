import { and, eq, inArray, sql } from 'drizzle-orm';
import db from '../db';

import { p } from '../../utils/Util';
import { InsertWord, words } from '../tables/words';
import { InsertStem, stems } from '../tables/stems';
import { WordView } from '../tables/wordView';
import { IServerSideGetRowsRequest } from 'ag-grid-community';
import natural from 'natural';

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
    private static wordView = db
        .select({
            id: words.id,
            word: words.word,
            translate: words.translate,
            stem: words.stem,
            note: words.note,
            familiar: stems.familiar,
        })
        .from(words)
        .leftJoin(stems, eq(words.stem, stems.stem))
        .as('wordView');

    public static async queryWords(
        ws: string[]
    ): Promise<Map<string, WordView>> {
        // eslint-disable-next-line no-param-reassign
        ws = ws.map((w) => p(w));
        if (ws.length === 0) {
            return new Map<string, WordView>();
        }
        const result = await db
            .select()
            .from(this.wordView)
            .where(inArray(this.wordView.word, ws));
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
            whereSql = 'length(word) = 3';
        }
        if (orderBySql.trim() === '') {
            // eslint-disable-next-line no-param-reassign
            orderBySql = 'word';
        }
        console.log('list', whereSql, orderBySql, perPage, currentPage);
        const offset = (currentPage - 1) * perPage;

        let sql1 = db
            .select()
            .from(this.wordView)
            .where(sql<boolean>`${whereSql}`)
            .orderBy(sql`${orderBySql}`)
            .offset(offset)
            .limit(perPage).getSQL();
        console.log('sql1', sql1);
        const [total, rows]: [{ count: number }[], WordView[]] =
            await Promise.all([
                db
                    .select({
                        count: sql<number>`cast(count(1) as int)`,
                    })
                    .from(this.wordView),

                db
                    .select()
                    .from(this.wordView)
                    .where(sql<boolean>`${whereSql}`)
                    .orderBy(sql`${orderBySql}`)
                    .offset(offset)
                    .limit(perPage),
            ]);
        const { count } = total[0] as any;
        rows.forEach((item) => {
            item.stem = item.stem ?? natural.PorterStemmer.stem(p(item.word));
            item.familiar = item.familiar ?? false;
        });
        const pagination: Pagination<WordView> = {
            total: count,
            perPage,
            offset,
            to: offset + rows.length,
            lastPage: Math.ceil(count / perPage),
            currentPage,
            from: offset,
            data: rows,
        };
        return pagination;
    }

    static async batchUpdate(views: WordView[]) {
        views.forEach((item) => {
            item.word = p(item.word);
            item.stem = natural.PorterStemmer.stem(p(item.word));
            item.familiar = item.familiar ?? false;
        });
        const wordsToUpdate = views.map(
            (item) =>
                ({
                    word: item.word,
                    translate: item.translate,
                    stem: item.stem,
                    note: item.note,
                } as InsertWord)
        );

        const stemsToUpdate = views.map(
            (item) =>
                ({
                    stem: item.stem,
                    familiar: item.familiar,
                } as InsertStem)
        );

        // eslint-disable-next-line no-restricted-syntax
        for (const item of wordsToUpdate) {
            // eslint-disable-next-line no-await-in-loop
            await db
                .insert(words)
                .values({
                    word: p(item.word ?? ''),
                    translate: item.translate,
                    stem: item.stem,
                    note: item.note,
                })
                .onConflictDoUpdate({
                    target: words.word,
                    set: {
                        translate: item.translate,
                        stem: item.stem,
                        note: item.note,
                    },
                });
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const item of stemsToUpdate) {
            // eslint-disable-next-line no-await-in-loop
            await db
                .insert(stems)
                .values({
                    stem: item.stem,
                    familiar: item.familiar,
                })
                .onConflictDoUpdate({
                    target: stems.stem,
                    set: {
                        familiar: item.familiar,
                    },
                });
        }
    }

    static async getRows(request: IServerSideGetRowsRequest): Promise<WordView[]> {
        console.log('getRows', request);
        const {startRow, endRow, filterModel } = request;

        let query = db.select().from(this.wordView);

        // if (filterModel) {
        //     let tq = and(sql`1 = 1`);
        //     for (const [key, value] of Object.entries(filterModel)) {
        //         if (value) {
        //             tq = and(tq, sql`${key} like '%${value.filter}%'`);
        //         }
        //     }
        //      query.where(tq);
        // }
        query.limit(endRow! - startRow!).offset(startRow!);
        console.log('query', query);
        return query;
    }
}
