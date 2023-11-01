import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
import { knexDb } from './BaseService';
import { p } from '../../utils/Util';

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
}
