import * as crypto from 'crypto';

import axios from 'axios';

export interface YouDaoConfig {
    from: string;
    to: string;
    appKey: string;
    secretKey: string;
}
class YouDaoClient {
    private config: YouDaoConfig;
    private readonly YOU_DAO_HOST = 'http://openapi.youdao.com/api';

    constructor(config: YouDaoConfig) {
        this.config = config;
    }

    public updateConfig(config: YouDaoConfig): void {
        this.config = config;
    }

    /**
     * md5加密
     */
    private static md5(str: string): string {
        const cryptoMd5 = crypto.createHash('md5');
        cryptoMd5.update(str);
        return cryptoMd5.digest('hex');
    }

    /**
     * 生成[0,n]区间的随机整数
     */
    private static getRandomN(roundTo: number): number {
        return Math.round(Math.random() * roundTo);
    }

    /**
     * {a:'111',b:'222'} => a=111&b=222
     */
    private static generateUrlParams(params: Map<string, string>): string {
        const paramsData: string[] = [];
        params.forEach((value, key) => {
            paramsData.push(`${key}=${value}`);
        });
        return paramsData.join('&');
    }

    /**
     * 进行翻译
     */
    public async translate(word: string): Promise<string | null> {
        // 在get请求中，中文需要进行uri编码
        const encodeURIWord = encodeURI(word);
        const salt = YouDaoClient.getRandomN(1000);
        const sign = YouDaoClient.md5(
            this.config.appKey + word + salt + this.config.secretKey
        );
        const paramsJson = new Map<string, string>();
        paramsJson.set('q', encodeURIWord);
        paramsJson.set('from', this.config.from);
        paramsJson.set('to', this.config.to);
        paramsJson.set('appKey', this.config.appKey);
        paramsJson.set('salt', salt.toString());
        paramsJson.set('sign', sign);
        // let url = `http://openapi.youdao.com/api?q=${encodeURI(q)}&from=${from}&to=${to}&appKey=${appKey}&salt=${salt}&sign=${sign}`;
        const url = `${this.YOU_DAO_HOST}?${YouDaoClient.generateUrlParams(
            paramsJson
        )}`;
        const result = await axios.get(url);
        if (result.data.errorCode !== '0') {
            console.error(result.data);
            return null;
        }
        return JSON.stringify(result.data);
    }
}
export default YouDaoClient;
