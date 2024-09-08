import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';
import { TextTranslateBatchResponse } from 'tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models';
import TransHolder from '../../common/utils/TransHolder';
import { strBlank } from '@/common/utils/Util';
import { storeGet } from '../store';
import RateLimiter from "@/common/utils/RateLimiter";
import dpLog from '@/backend/ioc/logger';

class TencentTransService {
    private static client: Client | null = null;

    private static SIZE_LIMIT = 1500;

    private static tryInit(): void {
        const secretId = storeGet('apiKeys.tencent.secretId');
        const secretKey = storeGet('apiKeys.tencent.secretKey');
        if (strBlank(secretId) || strBlank(secretKey)) {
            return;
        }
        const TmtClient = tencentcloud.tmt.v20180321.Client;
        const clientConfig = {
            credential: {
                secretId,
                secretKey,
            },
            region: 'ap-shanghai',
        };
        this.client = new TmtClient(clientConfig);
    }


    public static async batchTrans(
        source: string[]
    ): Promise<TransHolder<string>> {
        if (!this.client) {
            this.tryInit();
            if (!this.client) {
                return new TransHolder<string>();
            }
        }
        let temp = [];
        let tempSize = 0;
        let res = new TransHolder<string>();
        for (let i = 0; i < source.length; i += 1) {
            const item = source[i];
            if (tempSize + item.length > this.SIZE_LIMIT) {
                // eslint-disable-next-line no-await-in-loop
                const r = await this.trans(temp);
                res = res.merge(r);
                temp = [];
                tempSize = 0;
            }
            temp.push(item);
            tempSize += item.length;
        }
        if (temp.length > 0) {
            const r = await this.trans(temp);
            res = res.merge(r);
        }
        return res;
    }

    private static async trans(source: string[]) {
        if (!this.client) {
            return new TransHolder<string>();
        }
        await RateLimiter.wait('tencent');
        const param = {
            Source: 'en',
            Target: 'zh',
            ProjectId: 0,
            SourceTextList: source,
        };
        dpLog.info('do-trans:', source);
        const transResult: string[] = await this.client
            .TextTranslateBatch(param)
            .then((resp: TextTranslateBatchResponse) => resp.TargetTextList);
        const res = new TransHolder<string>();
        source.forEach((item, index) => {
            res.add(item, transResult[index]);
        });
        return res;
    }
}

export default TencentTransService;
