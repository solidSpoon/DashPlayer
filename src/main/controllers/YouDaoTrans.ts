import YouDaoTranslater, { YouDaoConfig } from '../ServerLib/YouDaoTranslater';
import WordTransCache from '../ServerLib/WordTransCache';
import KeyValueCache from '../ServerLib/KeyValueCache';

const config: YouDaoConfig = {
    from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
    to: 'EN',
    appKey: '', // https://ai.youdao.com 在有道云上进行注册
    secretKey: '',
};

const youDao = new YouDaoTranslater(config);

const youDaoTrans = async (str: string) => {
    const cacheRes = await WordTransCache.queryValue(str);
    if (cacheRes) {
        return cacheRes;
    }
    const appKey = await KeyValueCache.queryValue('youDaoSecretId');
    const secretKey = await KeyValueCache.queryValue('youDaoSecretKey');
    if (!appKey || !secretKey) {
        return null;
    }
    const c: YouDaoConfig = {
        from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
        to: 'EN',
        appKey,
        secretKey,
    };
    youDao.updateConfig(c);
    const onlineRes = await youDao.translate(str);
    if (!onlineRes) {
        return null;
    }
    await WordTransCache.updateValue(str, onlineRes);
    return onlineRes;
};
export default youDaoTrans;
