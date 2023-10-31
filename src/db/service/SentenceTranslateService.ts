import { knexDb } from './BaseService';
import {
    SENTENCE_TRANSLATE_TABLE_NAME,
    SentenceTranslate,
} from '../entity/SentenceTranslate';

export default class SentenceTranslateService {
    public static async fetchTranslates(
        sentences: string[]
    ): Promise<SentenceTranslate[]> {
        const value = (
            (await knexDb(SENTENCE_TRANSLATE_TABLE_NAME)
                .whereIn('sentence', sentences)
                .select('*')) as SentenceTranslate[]
        ).filter((e) => e.translate);
        if (knexDb.length === 0) {
            return [];
        }
        return value;
    }

    public static async recordTranslate(sentence: string, translate: string) {
        console.log('recordTranslate', sentence, translate);
        // eslint-disable-next-line no-param-reassign
        sentence = sentence.trim().toLowerCase();
        await knexDb
            .table(SENTENCE_TRANSLATE_TABLE_NAME)
            .insert({
                sentence,
                translate,
            } as SentenceTranslate)
            .catch(() => {
                // update
                knexDb
                    .table(SENTENCE_TRANSLATE_TABLE_NAME)
                    .where({ sentence } as SentenceTranslate)
                    .update({
                        translate,
                    } as SentenceTranslate);
            });
    }

    static async recordBatch(validTrans: SentenceTranslate[]) {
        validTrans.forEach((item) => {
            this.recordTranslate(item.sentence ?? '', item.translate ?? '');
        });
    }
}
