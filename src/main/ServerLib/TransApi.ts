import * as tencentcloud from 'tencentcloud-sdk-nodejs';
import { Client } from 'tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client';
import { TextTranslateBatchResponse } from 'tencentcloud-sdk-nodejs/src/services/tmt/v20180321/tmt_models';
import log from 'electron-log';
import TransHolder from '../../utils/TransHolder';

class TransApi {
    private static client: Client;

    private static SIZE_LIMIT = 1500;

    private static pass = false;

    static {
        TransApi.init('', '');
        setInterval(() => {
            TransApi.pass = true;
        }, 300);
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

    private static async waitPass(): Promise<void> {
        let count = 500;
        await new Promise((resolve) => {
            const timer = setInterval(() => {
                if (TransApi.pass) {
                    clearInterval(timer);
                    resolve(undefined);
                }
                count -= 1;
                if (count <= 0) {
                    clearInterval(timer);
                    resolve(undefined);
                }
            }, 100);
        });
    }

    public static async batchTrans2(
        source: string[]
    ): Promise<TransHolder<string>> {
        let temp = [];
        let tempSize = 0;
        let res = new TransHolder<string>();
        for (let i = 0; i < source.length; i += 1) {
            const item = source[i];
            if (tempSize + item.length > this.SIZE_LIMIT) {
                // eslint-disable-next-line no-await-in-loop
                const r = await this.trans2(temp);
                res = res.merge(r);
                temp = [];
                tempSize = 0;
            }
            temp.push(item);
            tempSize += item.length;
        }
        if (temp.length > 0) {
            const r = await this.trans2(temp);
            res = res.merge(r);
        }
        return res;
    }

    private static async trans2(source: string[]) {
        await this.waitPass();
        const param = {
            Source: 'en',
            Target: 'zh',
            ProjectId: 0,
            SourceTextList: source,
        };
        log.info('do-trans:', source);
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

export default TransApi;
