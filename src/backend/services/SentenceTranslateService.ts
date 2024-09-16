import { and, inArray, isNotNull } from 'drizzle-orm';
import TransHolder from '../../common/utils/TransHolder';
import db from '@/backend/db/db';
import {
    SentenceTranslate,
    sentenceTranslates,
} from '@/backend/db/tables/sentenceTranslates';
import { p } from '@/common/utils/Util';
import StrUtil from '@/common/utils/str-util';

export default class SentenceTranslateService {
    public static async fetchTranslates(
        sentences: string[]
    ): Promise<TransHolder<string>> {
        sentences = [...sentences, '-1'];
        const result = new TransHolder<string>();
        const values: SentenceTranslate[] = await db
            .select()
            .from(sentenceTranslates)
            .where(
                and(inArray(
                    sentenceTranslates.sentence,
                    sentences.map((w) => p(w))
                ), isNotNull(sentenceTranslates.translate))
            );
        values
            .filter((e) => !StrUtil.isBlank(e.translate))
            .forEach((e) => {
            result.add(e.sentence ?? '', e.translate ?? '');
        });

        return result;
    }

    public static async recordTranslate(sentence: string, translate: string) {
        await db
            .insert(sentenceTranslates)
            .values({
                sentence: p(sentence),
                translate,
            })
            .onConflictDoUpdate({
                target: sentenceTranslates.sentence,
                set: {
                    translate,
                },
            });
    }

    static async recordBatch(validTrans: TransHolder<string>) {
        validTrans.getMapping().forEach((value, key) => {
            this.recordTranslate(p(key), value);
        });
    }
}
