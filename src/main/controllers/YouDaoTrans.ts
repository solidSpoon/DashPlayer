import YouDaoTranslater, { YouDaoConfig } from '../ServerLib/YouDaoTranslater';
import { YdRes } from '../../renderer/lib/param/yd/a';
import { getSetting } from './SettingController';
import { strBlank } from '../../utils/Util';
import WordTranslateService from '../../db/services/WordTranslateService';

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
    const setting = await getSetting();
    const secret = setting.youdaoSecret;
    if (strBlank(secret.secretId) || strBlank(secret.secretKey)) {
        return null;
    }
    const c: YouDaoConfig = {
        from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
        to: 'EN',
        appKey: secret.secretId,
        secretKey: secret.secretKey,
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
