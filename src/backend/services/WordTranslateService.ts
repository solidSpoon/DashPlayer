import { eq } from 'drizzle-orm';
import { YdRes } from '@/common/types/YdRes';
import { p, strBlank } from '@/common/utils/Util';
import db from '@/backend/db/db';
import {
    InsertWordTranslate,
    WordTranslate,
    wordTranslates,
} from '@/backend/db/tables/wordTranslates';
import TimeUtil from "@/common/utils/TimeUtil";

export default class WordTranslateService {
    public static async fetchWordTranslate(
        word: string
    ): Promise<YdRes | undefined> {
        const value: WordTranslate[] = await db
            .select()
            .from(wordTranslates)
            .where(eq(wordTranslates.word, p(word)))
            .limit(1);

        if (value.length === 0) {
            return undefined;
        }

        const trans = value[0].translate;
        if (strBlank(trans)) {
            return undefined;
        }
        return JSON.parse(trans ?? '') as YdRes;
    }

    public static async recordWordTranslate(word: string, translate: YdRes) {
        const value = JSON.stringify(translate);
        const wt: InsertWordTranslate = {
            word: p(word),
            translate: value,
        };
        await db
            .insert(wordTranslates)
            .values(wt)
            .onConflictDoUpdate({
                target: wordTranslates.word,
                set: {
                    translate: wt.translate,
                    updated_at: TimeUtil.timeUtc(),
                },
            });
    }
}
