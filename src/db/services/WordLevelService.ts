import { p } from '../../utils/Util';
import { InsertWord, words } from '../tables/words';
import db from '../db';

export default class WordLevelService {
    public static async recordWordTranslate(word: string, translate: string) {
        const wordLevel: InsertWord = {
            word: p(word),
            translate,
        };

        await db
            .insert(words)
            .values(wordLevel)
            .onConflictDoUpdate({
                target: words.word,
                set: {
                    translate: wordLevel.translate,
                    updated_at: new Date().toISOString(),
                },
            });
    }
}
