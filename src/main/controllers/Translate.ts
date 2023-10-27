// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import TransApi from '../ServerLib/TransApi';

import { SentenceApiParam } from '../../types/TransApi';
import SentenceTranslateService from '../../db/service/SentenceTranslateService';
import { SentenceTranslate } from '../../db/entity/SentenceTranslate';

function merge(
    base: SentenceApiParam[],
    diff: SentenceTranslate[]
): SentenceApiParam[] {
    const mapping = new Map<string, string>();
    diff.forEach((e) => {
        mapping.set(e.sentence ?? '', e.translate ?? '');
    });
    const temp: SentenceApiParam[] = base.map((e) => {
        if (mapping.has(e.text?.trim() ?? '')) {
            return {
                ...e,
                translate: mapping.get(e.text?.trim() ?? ''),
            } as SentenceApiParam;
        }
        if (mapping.has(e.text ?? '')) {
            return {
                ...e,
                translate: mapping.get(e.translate ?? ''),
            } as SentenceApiParam;
        }
        return e;
    });
    return temp;
}

export const loadTransCache = async (
    sentences: SentenceApiParam[]
): Promise<SentenceApiParam[]> => {
    const dbDocs: SentenceTranslate[] =
        await SentenceTranslateService.fetchTranslates(
            sentences.map((e) => e.text)
        ).then((dbDoc) => dbDoc.filter((item) => item.translate));
    return merge(sentences, dbDocs);
};

/**
 * AI 翻译
 * @param str
 */
export default async function batchTranslate(
    sentences: SentenceApiParam[]
): Promise<SentenceApiParam[]> {
    const dbDocs: SentenceTranslate[] =
        await SentenceTranslateService.fetchTranslates(
            sentences.map((e) => e.text ?? '')
        );
    const temp = merge(sentences, dbDocs);
    console.log('merge', JSON.stringify(temp));
    const retries: SentenceTranslate[] = temp
        .filter((doc) => doc.translate === undefined || doc.translate === '')
        .map((e) => {
            return {
                sentence: e.text,
            } as SentenceTranslate;
        });
    if (retries.length === 0) {
        return temp;
    }
    try {
        const transResult: SentenceTranslate[] = await TransApi.batchTrans(
            retries
        );
        const validTrans = transResult.filter(
            (e) => e.translate !== undefined && e.translate !== null
        );
        await SentenceTranslateService.recordBatch(validTrans);
        const res = merge(temp, validTrans);
        return res;
    } catch (e) {
        console.error(e);
        return temp;
    }
}
