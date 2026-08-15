import { OpenAiService } from '@/backend/services/OpenAiService';
import OpenAI from 'openai';
import { injectable } from 'inversify';
import {storeGet} from '@/backend/infrastructure/settings/store';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import StrUtil from '@/common/utils/str-util';

@injectable()
export class OpenAIServiceImpl implements OpenAiService {
    private openai: OpenAI | null = null;
    private apiKey: string | null = null;
    private baseUrl: string | null = null;


    public getOpenAi(): OpenAI {
        const ak = storeGet('apiKeys.openAi.key');
        const ep = storeGet('apiKeys.openAi.endpoint');
        if (StrUtil.hasBlank(ak, ep)) {
            throw new Error('未设置 OpenAI 密钥');
        }
        const baseUrl = resolveOpenAiBaseUrl(ep, storeGet('apiKeys.openAi.autoAppendV1'));
        if (this.openai && this.apiKey === ak && this.baseUrl === baseUrl) {
            return this.openai;
        }
        this.apiKey = ak;
        this.baseUrl = baseUrl;
        this.openai = new OpenAI({
            baseURL: baseUrl,
            apiKey: ak
        });
        return this.openai;
    }
}
