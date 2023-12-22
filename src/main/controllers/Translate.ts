// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import TransApi from '../ServerLib/TransApi';

import { p } from '../../common/utils/Util';
import TransHolder from '../../common/utils/TransHolder';
import SentenceTranslateService from '../services/SentenceTranslateService';
/**
 * AI 翻译
 * @param str
 */
export default async function batchTranslate(
    sentences: string[]
): Promise<Map<string, string>> {
    // eslint-disable-next-line no-param-reassign
    sentences = sentences.map((s) => p(s));
    const cache: TransHolder<string> =
        await SentenceTranslateService.fetchTranslates(sentences);
    console.log('cache', cache.getMapping());
    const retries = sentences.filter((e) => !cache.get(e));
    console.log('retries', retries);
    if (retries.length === 0) {
        return cache.getMapping();
    }
    try {
        const transResult: TransHolder<string> = await TransApi.batchTrans2(
            retries
        );
        await SentenceTranslateService.recordBatch(transResult);
        return cache.merge(transResult).getMapping();
    } catch (e) {
        console.error(e);
        return cache.getMapping();
    }
}
