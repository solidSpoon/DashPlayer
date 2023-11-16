import natural from 'natural';
import { STEM_LEVEL_TABLE_NAME, StemLevel } from '../entity/StemLevel';
import { knexDb } from './BaseService';
import { p } from '../../utils/Util';

export const s = natural.PorterStemmer;
export default class StemLevelService {
    /**
     * 记录词干
     * @param word 原始单词
     * @param familiar 是否熟悉
     */
    public static async recordStem(word: string, familiar: boolean) {
        console.log('recordStem', word, familiar);
        await knexDb(STEM_LEVEL_TABLE_NAME)
            .insert({
                stem: p(s.stem(word)),
                familiar,
            } as StemLevel)
            .onConflict('stem')
            .merge();
    }

    public static tryAddStem(word: string) {
        return knexDb(STEM_LEVEL_TABLE_NAME)
            .insert({
                stem: p(s.stem(word)),
            } as StemLevel)
            .onConflict('stem')
            .merge();
    }

    public static async queryStems(
        words: string[]
    ): Promise<Map<string, boolean>> {
        if (words.length === 0) {
            return new Map<string, boolean>();
        }
        const result = (await knexDb
            .table(STEM_LEVEL_TABLE_NAME)
            .select('*')
            .whereIn(
                'stem',
                words.map((w) => p(s.stem(w)))
            )
            .catch((_err) => {
                return [];
            })) as StemLevel[];
        result.forEach((item) => {
            // eslint-disable-next-line eqeqeq
            if (item.familiar == false) {
                console.log('queryStems', item.stem, item.familiar);
                item.familiar = false;
            } else {
                item.familiar = true;
            }
        });
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
