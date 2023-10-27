import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
import { knexDb } from './BaseService';

export default class WordLevelService {
    public static async recordWordLevel(word: string, level: number) {
        await knexDb(WORD_LEVEL_TABLE_NAME)
            .insert({
                word,
                level,
            } as WordLevel)
            .catch((_err) => {
                // update
                knexDb
                    .table(WORD_LEVEL_TABLE_NAME)
                    .where({ word } as WordLevel)
                    .update({
                        level,
                    } as WordLevel);
            });
    }

    public static async recordWordTranslate(word: string, translate: string) {
        await knexDb
            .table(WORD_LEVEL_TABLE_NAME)
            .insert({
                word,
                translate,
            } as WordLevel)
            .catch((_err) => {
                // update
                knexDb
                    .table('dp_word_level')
                    .where({ word } as WordLevel)
                    .update({
                        translate,
                    } as WordLevel);
            });
    }

    public static async queryWord(
        word: string[]
    ): Promise<Map<string, WordLevel>> {
        const result = (await knexDb
            .table(WORD_LEVEL_TABLE_NAME)
            .select('*')
            .whereIn('word', word)
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
