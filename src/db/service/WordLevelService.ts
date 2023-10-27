// import { knexDb } from '../migration';
import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
import { knexDb } from './BaseService';

export const recordWordLevel = async (word: string, level: number) => {
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
};

export const recordWordTranslate = async (word: string, translate: string) => {
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
};
