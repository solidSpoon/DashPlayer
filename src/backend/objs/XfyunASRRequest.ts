import { storeGet } from '@/backend/store';
import RateLimiter from '@/common/utils/RateLimiter';
import dpLog from '@/backend/ioc/logger';
import StrUtil from '@/common/utils/str-util';
import { Cancelable } from '@/common/interfaces';
import {sparkASRRequest} from '@one-api-audio/xfyun'

export interface WhisperResponse {
    language: string;
    duration: number;
    text: string;
    offset: number;
    segments: {
        seek: number;
        start: number;
        end: number;
        text: string;
    }[];
}
/**
 * 讯飞云请求适配
 */
class XfyunASRRequest implements Cancelable {
    private readonly appId: string;
    private readonly secretKey: string;
    private readonly file: string;
    private controller : AbortController | null = null;

    constructor(file: string, apiKey: string, secretKey: string) {
        this.file = file;
        this.appId = apiKey;
        this.secretKey = secretKey;
    }

    public static build(file: string): XfyunASRRequest | null {
        const apiKey = storeGet('apiKeys.xfyun.appId');
        const secretKey = storeGet('apiKeys.xfyun.secretKey');
        if (StrUtil.hasBlank(file, apiKey, secretKey)) {
            return null;
        }
        return new XfyunASRRequest(file, apiKey, secretKey);
    }

    public async invoke(): Promise<WhisperResponse> {
        if (this.controller) {
            this.controller.abort('Operation canceled by the user');
            this.controller = null;
        }
        await RateLimiter.wait('whisper');
        this.controller = new AbortController();
        const resp  = await sparkASRRequest(this.file,this.appId,this.secretKey,this.controller.signal).catch((error)=>{
            if(this.controller?.signal.aborted){
                dpLog.info('Request canceled', error.message);
            }
            dpLog.error('Request error', error);
            throw error;
        }) 
        return resp as WhisperResponse 
    }

    public cancel(): void {
        if (this.controller) {
            this.controller.abort('Operation canceled by the user');
            this.controller = null;
        }
    }

}

export default XfyunASRRequest;
