// import { WORD_VIEW_TABLE_NAME, WordView } from '../entity/WordView';
// import { knexDb } from './BaseService';
// import { p } from '../../utils/Util';
// import { s } from './StemLevelService';
// import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
// import { STEM_LEVEL_TABLE_NAME, StemLevel } from '../entity/StemLevel';
//
// export interface Pagination<T> {
//     total: number;
//     perPage: number;
//     offset: number;
//     to: number;
//     lastPage: number;
//     currentPage: number;
//     from: number;
//     data: T[];
// }
//
// export default class WordViewService {
//
//     public static async queryWords(
//         words: string[]
//     ): Promise<Map<string, WordView>> {
//         // eslint-disable-next-line no-param-reassign
//         words = words.map((w) => p(w));
//         if (words.length === 0) {
//             return new Map<string, WordView>();
//         }
//         const result = (await knexDb
//             .table(WORD_VIEW_TABLE_NAME)
//             .select('*')
//             .whereIn('word', words)
//             .catch((_err) => {
//                 return [];
//             })) as WordView[];
//         const map = new Map<string, WordView>();
//         result.forEach((item) => {
//             map.set(p(item.word) ?? '', item);
//         });
//         return map;
//     }
//
//     static async list(
//         whereSql: string,
//         orderBySql: string,
//         perPage: number,
//         currentPage: number
//     ): Promise<Pagination<WordView>> {
//         if (whereSql.trim() === '') {
//             // eslint-disable-next-line no-param-reassign
//             whereSql = '1 = 1';
//         }
//         if (orderBySql.trim() === '') {
//             // eslint-disable-next-line no-param-reassign
//             orderBySql = 'word';
//         }
//         console.log('list', whereSql, orderBySql, perPage, currentPage);
//         const offset = (currentPage - 1) * perPage;
//         const [total, rows] = await Promise.all([
//             knexDb
//                 .count('* as count')
//                 .from(WORD_VIEW_TABLE_NAME)
//                 .whereRaw(whereSql)
//                 .orderByRaw(orderBySql)
//                 .first(),
//             knexDb
//                 .select('*')
//                 .from(WORD_VIEW_TABLE_NAME)
//                 .whereRaw(whereSql)
//                 .orderByRaw(orderBySql)
//                 .offset(offset)
//                 .limit(perPage),
//         ]);
//         const count = (total?.count ?? 0) as number;
//         const pagination: Pagination<WordView> = {
//             total: count,
//             perPage,
//             offset,
//             to: offset + rows.length,
//             lastPage: Math.ceil(count / perPage),
//             currentPage,
//             from: offset,
//             data: rows,
//         };
//         return pagination;
//     }
//
//     static async batchUpdate(views: WordView[]) {
//         const words = views.map((item) => ({
//             word: p(item.word),
//             translate: item.translate,
//             stem: item.stem,
//             note: item.note,
//         }as WordLevel));
//
//         const stems = views.map((item) => ({
//             stem: item.stem,
//             familiar: item.familiar,
//         } as StemLevel));
//
//         for (const item of words) {
//             await knexDb
//                 .table(WORD_LEVEL_TABLE_NAME)
//                 .insert({
//                     word: p(item.word ?? ''),
//                     translate: item.translate,
//                     stem: item.stem,
//                     note: item.note
//                 } as WordView)
//                 .onConflict('word')
//                 .merge();
//         }
//
//         for (const item of stems) {
//             await knexDb
//                 .table(STEM_LEVEL_TABLE_NAME)
//                 .insert({
//                     stem: p(item.stem ?? ''),
//                     familiar: item.familiar,
//                 } as StemLevel)
//                 .onConflict('stem')
//                 .merge();
//         }
//     }
// }
