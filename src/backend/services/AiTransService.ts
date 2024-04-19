import YouDaoTranslater, {YouDaoConfig} from "@/backend/services/YouDaoTranslater";
import {YdRes} from "@/common/types/YdRes";
import WordTranslateService from "@/backend/services/WordTranslateService";
import {storeGet} from "@/backend/store";
import {p} from "@/common/utils/Util";
import TransHolder from "@/common/utils/TransHolder";
import SentenceTranslateService from "@/backend/services/SentenceTranslateService";
import TencentTransService from "@/backend/services/TencentTransService";

export default class AiTransService{
    public static async youDaoTrans(str: string): Promise<YdRes | null> {
        const cacheRes = await WordTranslateService.fetchWordTranslate(str);
        if (cacheRes) {
            console.log('cacheRes', cacheRes);
            return cacheRes;
        }
        const secretId = storeGet('apiKeys.youdao.secretId');
        const secretKey = storeGet('apiKeys.youdao.secretKey');
        const c: YouDaoConfig = {
            from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
            to: 'EN',
            appKey: secretId,
            secretKey,
        };
        youDao.updateConfig(c);
        const onlineRes = await youDao.translate(str);
        if (!onlineRes) {
            return null;
        }
        const or = JSON.parse(onlineRes) as YdRes;
        await WordTranslateService.recordWordTranslate(str, or);
        return or;
    }


    public static async batchTranslate(
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
            const transResult: TransHolder<string> = await TencentTransService.batchTrans(
                retries
            );
            await SentenceTranslateService.recordBatch(transResult);
            return cache.merge(transResult).getMapping();
        } catch (e) {
            console.error(e);
            return cache.getMapping();
        }
    }
}
const config: YouDaoConfig = {
    from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
    to: 'EN',
    appKey: '', // https://ai.youdao.com 在有道云上进行注册
    secretKey: '',
};
export const youDao = new YouDaoTranslater(config);
