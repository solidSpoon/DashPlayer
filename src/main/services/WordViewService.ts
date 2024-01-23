import { and, eq, inArray, sql } from 'drizzle-orm';
import { IServerSideGetRowsRequest } from 'ag-grid-community';
import natural from 'natural';
import db from '../../db/db';

import { p } from '../../common/utils/Util';
import { InsertWord, words } from '../../db/tables/words';
import { InsertStem, stems } from '../../db/tables/stems';
import { WordView } from '../../common/types/wordView';
import { MarkupType } from '../../renderer/hooks/useDataPage/Types';

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
            markup: sql<MarkupType>`'default'`.as('markup'),
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
            whereSql = '1 = 1';
        }
        if (orderBySql.trim() === '') {
            // eslint-disable-next-line no-param-reassign
            orderBySql = 'word';
        }
        console.log('list', whereSql, orderBySql, perPage, currentPage);
        const offset = (currentPage - 1) * perPage;
        const [total, rows]: [{ count: number }[], WordView[]] =
            await Promise.all([
                db
                    .select({
                        count: sql<number>`cast(count(1) as int)`,
                    })
                    .from(this.wordView)
                    .where(sql.raw(whereSql))
                ,

                db
                    .select()
                    .from(this.wordView)
                    .where(sql.raw(whereSql))
                    .orderBy(sql.raw(orderBySql))
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
        views = views
            .filter((item) => item.markup !== 'default')
            .filter((item) => item.markup !== 'new-delete');
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
        const deleteIds = views
            .filter((item) => item.markup === 'delete')
            .map((item) => item.id);
        if (deleteIds.length > 0) {
            await db.delete(words).where(inArray(words.id, deleteIds));
        }
    }

    static async getRows(
        request: IServerSideGetRowsRequest
    ): Promise<WordView[]> {
        // console.log('getRows', request);
        // const {startRow, endRow, filterModel } = request;
        //
        // let query = db.select().from(this.wordView);
        // query.limit(endRow! - startRow!).offset(startRow!);
        // return query;
        return [];
    }
}
