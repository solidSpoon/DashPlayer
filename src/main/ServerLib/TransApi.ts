// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
// import getConfig from 'next/config'
import * as tencentcloud from "tencentcloud-sdk-nodejs";
import { Client } from "tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client";
import TransCacheEntity from "./entity/TransCacheEntity";
import { TextTranslateBatchResponse } from "tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models";
import { secretId, secretKey } from "./basecache/Key";

class TransApi {
    private static client: Client;

    static {
        // const {serverRuntimeConfig, publicRuntimeConfig} = getConfig();
        const TmtClient = tencentcloud.tmt.v20180321.Client;
        const clientConfig = {
            credential: {
                secretId: secretId,
                secretKey: secretKey
            },
            region: "ap-shanghai"
        };
        this.client = new TmtClient(clientConfig);
    }

    /**
     * 批量翻译
     * @param source
     */
    public static async batchTrans(source: TransCacheEntity[]): Promise<TransCacheEntity[]> {
        const param = {
            Source: "en",
            Target: "zh",
            ProjectId: 0,
            SourceTextList: source.map(item => item.original)
        };
        console.log("do-trans:", param.SourceTextList);


        const transResult: string[] = await this.client.TextTranslateBatch(param)
            .then((resp: TextTranslateBatchResponse) => resp.TargetTextList);
        return this.fillToSource(source, transResult);
    }

    private static fillToSource(source: TransCacheEntity[], result: string[]): TransCacheEntity[] {
        source.forEach((item, index) => {
            item.translate = result[index];
        });
        return source;
    }

}

export default TransApi;
