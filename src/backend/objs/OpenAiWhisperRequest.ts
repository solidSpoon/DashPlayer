import { storeGet } from '@/backend/store';
import fs from 'fs';
import RateLimiter from '@/common/utils/RateLimiter';
import FormData from 'form-data';
import axios, { CancelTokenSource } from 'axios';
import UrlUtil from '@/common/utils/UrlUtil';
import dpLog from '@/backend/ioc/logger';
import StrUtil from '@/common/utils/str-util';
import { Cancelable } from '@/common/interfaces';
import CancelByUserError from '@/backend/errors/CancelByUserError';

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

class OpenAiWhisperRequest implements Cancelable {
    private readonly apiKey: string;
    private readonly endpoint: string;
    private readonly file: string;
    private cancelTokenSource: CancelTokenSource | null = null;

    constructor(file: string, apiKey: string, endpoint: string) {
        this.file = file;
        this.apiKey = apiKey;
        this.endpoint = endpoint;
    }

    public static build(file: string): OpenAiWhisperRequest | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (StrUtil.hasBlank(file, apiKey, endpoint)) {
            return null;
        }
        return new OpenAiWhisperRequest(file, apiKey, endpoint);
    }

    public async invoke(): Promise<WhisperResponse> {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel('Operation canceled by the user');
            this.cancelTokenSource = null;
        }
        await RateLimiter.wait('whisper');
        const data = new FormData();
        data.append('file', fs.createReadStream(this.file) as any);
        data.append('model', 'whisper-1');
        data.append('language', 'en');
        data.append('response_format', 'verbose_json');

        this.cancelTokenSource = axios.CancelToken.source();

        // 创建一个 CancelToken 的实例
        const config = {
            method: 'post',
            url: UrlUtil.joinWebUrl(this.endpoint, '/v1/audio/transcriptions'),
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'multipart/form-data',
                ...data.getHeaders()
            },
            data: data,
            timeout: 1000 * 60 * 10,
            cancelToken: this.cancelTokenSource.token
        };

        const response = await axios(config)
            .catch((error) => {
                if (axios.isCancel(error)) {
                    dpLog.info('Request canceled', error.message);
                    throw new CancelByUserError();
                }
                dpLog.error('Request error', error);
                throw error;
            });
        return {
            ...response.data
        };
    }

    public cancel(): void {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel('Operation canceled by the user');
            this.cancelTokenSource = null;
        }
    }

}

export default OpenAiWhisperRequest;
