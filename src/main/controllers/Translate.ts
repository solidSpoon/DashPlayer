// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import TransCacheEntity from '../ServerLib/entity/TransCacheEntity';
import TranslateCache from '../ServerLib/TranslateCache';
import TransApi from '../ServerLib/TransApi';
/**
 * AI 翻译
 * @param str
 */
export default async function batchTranslate(str: string[]): Promise<string[]> {
    const sourceArr: TransCacheEntity[] = str.map(
        (item) => new TransCacheEntity(item)
    );

    const dbDocs: TransCacheEntity[] = await TranslateCache.loadCache(
        sourceArr
    ).then((dbDoc) => dbDoc.filter((item) => item.translate !== undefined));

    dbDocs.forEach((doc) => {
        const finds: TransCacheEntity[] = sourceArr.filter(
            (item) => item.hash === doc.hash
        );
        finds.forEach((find) => {
            find.translate = doc.translate;
        });
    });
    const retryDoc: TransCacheEntity[] = sourceArr.filter(
        (doc) => doc.translate === undefined
    );
    if (retryDoc.length === 0) {
        return sourceArr.map((doc) => doc.translate);
    }
    const transResult: TransCacheEntity[] = await TransApi.batchTrans(retryDoc);
    await TranslateCache.insertBatch(transResult);
    return sourceArr.map((doc) => doc.translate);
}
