import { WORD_LEVEL_TABLE_NAME, WordLevel } from '../entity/WordLevel';
import { knexDb } from './BaseService';
import { p } from '../../utils/Util';
import { s } from './StemLevelService';

export default class WordLevelService {
    public static async recordWordTranslate(word: string, translate: string) {
        console.log('recordWordTranslate bbbbss', word, translate);
        await knexDb<WordLevel>(WORD_LEVEL_TABLE_NAME)
            .insert({
                word: p(word),
                translate,
                stem: s.stem(word),
            })
            .onConflict('word')
            .merge();
    }
}
