// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { d } from '@pmmmwh/react-refresh-webpack-plugin/types/options';
import TransCacheEntity from '../ServerLib/entity/TransCacheEntity';
import TranslateCache from '../ServerLib/TranslateCache';
import TransApi from '../ServerLib/TransApi';
import { SentenceApiParam } from '../../renderer/hooks/useSubtitle';

function merge(sentences: SentenceApiParam[], dbDocs: TransCacheEntity[]) {
    const mapping = new Map<string, string>();
    dbDocs.forEach((doc) => {
        mapping.set(doc.original, doc.translate ?? '');
    });
    const temp: SentenceApiParam[] = sentences.map((e) => {
        if (mapping.has(e.text ?? '')) {
            return {
                ...e,
                translate: mapping.get(e.text ?? ''),
            } as SentenceApiParam;
        }
        return e;
    });
    return temp;
}

export const loadTransCache = async (
    sentences: SentenceApiParam[]
): Promise<SentenceApiParam[]> => {
    const sourceArr: TransCacheEntity[] = sentences.map(
        (e) => new TransCacheEntity(e.text ?? '')
    );
    const dbDocs: TransCacheEntity[] = await TranslateCache.loadCache(
        sourceArr
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
    const sourceArr: TransCacheEntity[] = sentences.map(
        (item) => new TransCacheEntity(item.text ?? '')
    );
    const dbDocs: TransCacheEntity[] = await TranslateCache.loadCache(
        sourceArr
    ).then((dbDoc) => dbDoc.filter((item) => item.translate));
    const temp = merge(sentences, dbDocs);
    const retries: SentenceApiParam[] = temp.filter(
        (doc) => doc.translate === undefined || doc.translate === ''
    );
    if (retries.length === 0) {
        return temp;
    }
    try {
        const retryDoc: TransCacheEntity[] = retries.map(
            (item) => new TransCacheEntity(item.text ?? '')
        );
        const transResult: TransCacheEntity[] = await TransApi.batchTrans(
            retryDoc
        );
        const validTrans = transResult.filter(
            (e) => e.translate !== undefined && e.translate !== null
        );
        await TranslateCache.insertBatch(validTrans);
        const res = merge(temp, validTrans);
        return res;
    } catch (e) {
        console.error(e);
        return temp;
    }
}
