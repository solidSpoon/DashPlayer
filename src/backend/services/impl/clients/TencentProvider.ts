import { storeGet } from '@/backend/store';
import { injectable } from 'inversify';
import ClientProviderService from '@/backend/services/ClientProviderService';
import StrUtil from '@/common/utils/str-util';
import TencentClient from '@/backend/objs/TencentClient';


@injectable()
export default class TencentProvider implements ClientProviderService<TencentClient> {
    private client: TencentClient | null = null;
    private localSecretId: string | null = null;
    private localSecretKey: string | null = null;


    private initClient(): void {
        if (StrUtil.isBlank(this.localSecretId) || StrUtil.isBlank(this.localSecretKey)) {
            return;
        }
        const clientConfig = {
            credential: {
                secretId: this.localSecretId,
                secretKey: this.localSecretKey
            },
            region: 'ap-shanghai'
        };
        this.client = new TencentClient(clientConfig);
    }

    public getClient(): TencentClient | null {
        const secretId = storeGet('apiKeys.tencent.secretId');
        const secretKey = storeGet('apiKeys.tencent.secretKey');
        if (StrUtil.hasBlank(secretId, secretKey)) {
            return null;
        }
        if (this.localSecretId === secretId && this.localSecretKey === secretKey && this.client) {
            return this.client;
        }
        this.localSecretId = secretId;
        this.localSecretKey = secretKey;
        this.initClient();
        return this.client;
    }
}
