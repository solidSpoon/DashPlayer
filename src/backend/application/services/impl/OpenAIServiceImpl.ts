import { OpenAiService } from '@/backend/application/services/OpenAiService';
import OpenAI from 'openai';
import { injectable } from 'inversify';
import {storeGet} from '@/backend/infrastructure/settings/store';
import StrUtil from '@/common/utils/str-util';

@injectable()
export class OpenAIServiceImpl implements OpenAiService {
    private openai: OpenAI | null = null;
    private apiKey: string | null = null;
    private endpoint: string | null = null;


    public getOpenAi(): OpenAI {
        const ak = storeGet('credentials.openai.apiKey');
        const ep = storeGet('credentials.openai.endpoint');
        if (StrUtil.hasBlank(ak, ep)) {
            throw new Error('未设置 OpenAI 密钥');
        }
        if (this.openai && this.apiKey === ak && this.endpoint === ep) {
            return this.openai;
        }
        this.apiKey = ak;
        this.endpoint = ep;
        this.openai = new OpenAI({
            baseURL: ep + '/v1',
            apiKey: ak
        });
        return this.openai;
    }
}
