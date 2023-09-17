import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';
import { TextTranslateBatchResponse } from 'tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models';
import log from 'electron-log';
import TransCacheEntity from './entity/TransCacheEntity';
// eslint-disable-next-line import/no-cycle
import KeyValueCache from './KeyValueCache';

class TransApi {
    private static client: Client;

    static {
        TransApi.init();
    }

    public static async init() {
        const TmtClient = tencentcloud.tmt.v20180321.Client;
        const secretId = await KeyValueCache.queryValue('tenantSecretId');
        const secretKey = await KeyValueCache.queryValue('tenantSecretKey');
        const clientConfig = {
            credential: {
                secretId,
                secretKey,
            },
            region: 'ap-shanghai',
        };
        this.client = new TmtClient(clientConfig);
    }

    /**
     * 批量翻译
     * @param source
     */
    public static async batchTrans(
        source: TransCacheEntity[]
    ): Promise<TransCacheEntity[]> {
        const param = {
            Source: 'en',
            Target: 'zh',
            ProjectId: 0,
            SourceTextList: source.map((item) => item.original),
        };
        log.info('do-trans:', param.SourceTextList);

        const transResult: string[] = await this.client
            .TextTranslateBatch(param)
            .then((resp: TextTranslateBatchResponse) => resp.TargetTextList);
        return this.fillToSource(source, transResult);
    }

    private static fillToSource(
        source: TransCacheEntity[],
        result: string[]
    ): TransCacheEntity[] {
        source.forEach((item, index) => {
            item.translate = result[index];
        });
        return source;
    }
}

export default TransApi;
