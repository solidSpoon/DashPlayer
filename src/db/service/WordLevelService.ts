import { IWithPagination } from 'knex-paginate';
import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
import { knexDb } from './BaseService';
import { p } from '../../utils/Util';

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

export default class WordLevelService {
    public static async recordWordLevel(word: string, level: number) {
        console.log('recordWordLevel', word, level);
        await knexDb(WORD_LEVEL_TABLE_NAME)
            .insert({
                word: p(word),
                level,
            } as WordLevel)
            .onConflict('word')
            .merge();
    }

    public static async recordWordTranslate(word: string, translate: string) {
        try {
            await knexDb
                .table(WORD_LEVEL_TABLE_NAME)
                .insert({
                    word: p(word),
                    translate,
                } as WordLevel)
                .onConflict('word')
                .merge();
        } catch (err) {
            console.log('update');
        }
    }

    public static async queryWords(
        words: string[]
    ): Promise<Map<string, WordLevel>> {
        // eslint-disable-next-line no-param-reassign
        words = words.map((w) => p(w));
        if (words.length === 0) {
            return new Map<string, WordLevel>();
        }
        const result = (await knexDb
            .table(WORD_LEVEL_TABLE_NAME)
            .select('*')
            .whereIn('word', words)
            .catch((_err) => {
                return [];
            })) as WordLevel[];
        const map = new Map<string, WordLevel>();
        result.forEach((item) => {
            map.set(item.word ?? '', item);
        });
        return map;
    }

    //     router.get("/", (req, res) => {
    //     var reqData = req.query;
    //     var pagination = {};
    //     var per_page = reqData.per_page || 10;
    //     var page = reqData.current_page || 1;
    //     if (page < 1) page = 1;
    //     var offset = (page - 1) * per_page;
    //     return Promise.all([
    //                            db.count('* as count').from("site.site_product").first(),
    //                            db.select("*").from("site.site_product").offset(offset).limit(per_page)
    //                        ]).then(([total, rows]) => {
    //     var count = total.count;
    //     var rows = rows;
    //     pagination.total = count;
    //     pagination.per_page = per_page;
    //     pagination.offset = offset;
    //     pagination.to = offset + rows.length;
    //     pagination.last_page = Math.ceil(count / per_page);
    //     pagination.current_page = page;
    //     pagination.from = offset;
    //     pagination.data = rows;
    //     res.render("inventory/site_product", {
    //     data: pagination
    // });
    // });
    // });

    static async list(
        perPage: number,
        currentPage: number
    ): Promise<Pagination<WordLevel>> {
        const offset = (currentPage - 1) * perPage;
        const [total, rows] = await Promise.all([
            knexDb.count('* as count').from(WORD_LEVEL_TABLE_NAME).first(),
            knexDb
                .select('*')
                .from(WORD_LEVEL_TABLE_NAME)
                .offset(offset)
                .limit(perPage),
        ]);
        const count = (total?.count ?? 0) as number;
        const pagination: Pagination<WordLevel> = {
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

    static async batchUpdate(words: WordLevel[]) {
        console.log('batchUpdate', words);
        words.forEach(async (item) => {
            await knexDb
                .table(WORD_LEVEL_TABLE_NAME)
                .insert({
                    word: p(item.word ?? ''),
                    translate: item.translate,
                    level: item.level,
                } as WordLevel)
                .onConflict('word')
                .merge();
        });
    }
}
