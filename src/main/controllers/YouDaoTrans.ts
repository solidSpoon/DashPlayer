import YouDaoTranslater, { YouDaoConfig } from '../services/YouDaoTranslater';
import { YdRes } from '../../common/types/YdRes';
import WordTranslateService from '../services/WordTranslateService';
import { storeGet } from '../store';

const config: YouDaoConfig = {
    from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
    to: 'EN',
    appKey: '', // https://ai.youdao.com 在有道云上进行注册
    secretKey: '',
};

const youDao = new YouDaoTranslater(config);

const youDaoTrans = async (str: string): Promise<YdRes | null> => {
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
};
export default youDaoTrans;
