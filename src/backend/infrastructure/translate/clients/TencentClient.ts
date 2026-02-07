import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';
import { ClientConfig } from 'tencentcloud-sdk-nodejs/tencentcloud/common/interface';
import TransHolder from '@/common/utils/TransHolder';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { TextTranslateBatchResponse } from 'tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models';
import { WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';

class TencentClient extends Client {
    private readonly SIZE_LIMIT: number;
    private readonly logger = getMainLogger('TencentClient');

    constructor(clientConfig: ClientConfig) {
        super(clientConfig);
        this.SIZE_LIMIT = 1500;
    }


    public async batchTrans(
      source: string[]
    ): Promise<TransHolder<string>> {
        let res = new TransHolder<string>();
        for await (const batch of this.batchGenerator(source)) {
            const r = await this.trans(batch);
            res = res.merge(r);
        }
        return res;
    }

    private* batchGenerator(source: string[]): Generator<string[]> {
        let temp: string[] = [];
        let tempSize = 0;
        for (const item of source) {
            if (tempSize + item.length > this.SIZE_LIMIT) {
                yield temp;
                temp = [];
                tempSize = 0;
            }
            temp.push(item);
            tempSize += item.length;
        }
        if (temp.length > 0) {
            yield temp;
        }
    }

    @WithRateLimit('tencent')
    private async trans(source: string[]) {
        const param = {
            Source: 'en',
            Target: 'zh',
            ProjectId: 0,
            SourceTextList: source
        };
        this.logger.info('do-trans:', source);
        const transResult: string[] | undefined = await super
          .TextTranslateBatch(param)
          .then((resp: TextTranslateBatchResponse) => resp.TargetTextList);
        if (!transResult) {
            return new TransHolder<string>();
        }
        const res = new TransHolder<string>();
        source.forEach((item, index) => {
            res.add(item, transResult[index]);
        });
        return res;
    }
}
export default TencentClient;
