import KeyValueCache from '../ServerLib/KeyValueCache';
import WordTransCache from '../ServerLib/WordTransCache';
import YouDaoTranslater, { YouDaoConfig } from '../ServerLib/YouDaoTranslater';
import { YdRes } from '../../renderer/lib/param/yd/a';

const config: YouDaoConfig = {
    from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
    to: 'EN',
    appKey: '', // https://ai.youdao.com 在有道云上进行注册
    secretKey: '',
};

const youDao = new YouDaoTranslater(config);

const youDaoTrans = async (str: string): Promise<YdRes | null> => {
    const cacheRes = await WordTransCache.queryValue(str);
    if (cacheRes) {
        return JSON.parse(cacheRes) as YdRes;
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
    return JSON.parse(onlineRes) as YdRes;
};
export default youDaoTrans;
