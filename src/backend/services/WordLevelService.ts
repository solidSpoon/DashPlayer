import { p } from '@/common/utils/Util';
import { InsertWord, words } from '@/backend/db/tables/words';
import db from '@/backend/db/db';
import natural from 'natural';

export default class WordLevelService {
    public static async recordWordTranslate(word: string, translate: string) {
        const wordLevel: InsertWord = {
            word: p(word),
            stem: natural.PorterStemmer.stem(word),
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
