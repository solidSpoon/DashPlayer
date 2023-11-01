import { knexDb } from './BaseService';
import {
    SENTENCE_TRANSLATE_TABLE_NAME,
    SentenceTranslate,
} from '../entity/SentenceTranslate';
import TransHolder from '../../utils/TransHolder';

export default class SentenceTranslateService {
    public static async fetchTranslates(
        sentences: string[]
    ): Promise<TransHolder<string>> {
        const result = new TransHolder<string>();
        const value = (
            (await knexDb(SENTENCE_TRANSLATE_TABLE_NAME)
                .whereIn('sentence', sentences)
                .select('*')) as SentenceTranslate[]
        ).filter((e) => e.translate);
        value.forEach((e) => {
            result.add(e.sentence ?? '', e.translate ?? '');
        });
        return result;
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

    static async recordBatch(validTrans: TransHolder<string>) {
        validTrans.getMapping().forEach((value, key) => {
            this.recordTranslate(key, value);
        });
    }
}
