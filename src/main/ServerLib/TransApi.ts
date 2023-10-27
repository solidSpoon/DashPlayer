import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';
import { TextTranslateBatchResponse } from 'tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models';
import log from 'electron-log';
import { SentenceTranslate } from '../../db/entity/SentenceTranslate';

class TransApi {
    private static client: Client;

    static {
        TransApi.init('', '');
    }

    public static async init(
        secretId: string,
        secretKey: string
    ): Promise<void> {
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

    /**
     * 批量翻译
     * @param source
     */
    public static async batchTrans(
        source: SentenceTranslate[]
    ): Promise<SentenceTranslate[]> {
        const param = {
            Source: 'en',
            Target: 'zh',
            ProjectId: 0,
            SourceTextList: source.map((item) => item.sentence ?? ''),
        };
        log.info('do-trans:', param.SourceTextList);

        const transResult: string[] = await this.client
            .TextTranslateBatch(param)
            .then((resp: TextTranslateBatchResponse) => resp.TargetTextList);
        return this.fillToSource(source, transResult);
    }

    private static fillToSource(
        source: SentenceTranslate[],
        result: string[]
    ): SentenceTranslate[] {
        source.forEach((item, index) => {
            item.translate = result[index];
        });
        return source;
    }
}

export default TransApi;
