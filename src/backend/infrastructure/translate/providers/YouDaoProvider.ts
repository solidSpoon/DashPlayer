import { storeGet } from '@/backend/infrastructure/settings/store';
import { injectable } from 'inversify';
import ClientProviderService from '@/backend/application/services/ClientProviderService';
import StrUtil from '@/common/utils/str-util';
import YouDaoClient, { YouDaoConfig } from '@/backend/infrastructure/translate/clients/YouDaoClient';

@injectable()
export default class YouDaoProvider implements ClientProviderService<YouDaoClient> {
    private youDao = new YouDaoClient({
        from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
        to: 'EN',
        appKey: '', // https://ai.youdao.com 在有道云上进行注册
        secretKey: '',
    });

    public getClient(): YouDaoClient | null {
        const secretId = storeGet('credentials.youdao.secretId');
        const secretKey = storeGet('credentials.youdao.secretKey');
        if (StrUtil.hasBlank(secretId, secretKey)) {
            return null;
        }
        const config: YouDaoConfig = {
            from: 'zh_CHS', // zh-CHS(中文) || ja(日语) || EN(英文) || fr(法语) ...
            to: 'EN',
            appKey: secretId,
            secretKey,
        };
        this.youDao.updateConfig(config);
        return this.youDao;
    }
}
