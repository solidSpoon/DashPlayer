import {
    WORD_TRANSLATE_TABLE_NAME,
    WordTranslate,
} from '../entity/WordTranslate';
import { knexDb } from './BaseService';
import { YdRes } from '../../renderer/lib/param/yd/a';
import { p } from '../../utils/Util';

export default class WordTranslateService {
    public static async fetchWordTranslate(
        word: string
    ): Promise<YdRes | undefined> {
        // eslint-disable-next-line no-param-reassign
        word = p(word);
        const value = (
            await knexDb(WORD_TRANSLATE_TABLE_NAME)
                .where({ word } as WordTranslate)
                .select('translate')
                .limit(1)
        )
            .map((e) => e.translate)
            .filter((e) => !e)
            .map((e) => JSON.parse(e) as YdRes);
        if (knexDb.length === 0) {
            return undefined;
        }

        return value[0];
    }

    public static async recordWordTranslate(word: string, translate: YdRes) {
        // eslint-disable-next-line no-param-reassign
        word = p(word);
        const value = JSON.stringify(translate);
        await knexDb
            .table(WORD_TRANSLATE_TABLE_NAME)
            .insert({
                word,
                translate: value,
            } as WordTranslate)
            .catch((_err) => {
                // update
                knexDb
                    .table(WORD_TRANSLATE_TABLE_NAME)
                    .where({ word } as WordTranslate)
                    .update({
                        translate: value,
                    } as WordTranslate);
            });
    }
}
