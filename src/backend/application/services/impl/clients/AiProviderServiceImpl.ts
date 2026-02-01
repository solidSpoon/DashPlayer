import { storeGet } from '@/backend/infrastructure/settings/store';
import StrUtil from '@/common/utils/str-util';
import { joinUrl } from '@/common/utils/Util';
import { injectable } from 'inversify';
import AiProviderService from '@/backend/application/services/AiProviderService';
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';


@injectable()
export default class AiProviderServiceImpl implements AiProviderService {

    public getModel(): LanguageModel | null {
        const apiKey = storeGet('credentials.openai.apiKey');
        const endpoint = storeGet('credentials.openai.endpoint');
        let model = storeGet('credentials.openai.model');
        if (StrUtil.isBlank(model)) {
            model = 'gpt-4o-mini';
        }
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            return null;
        }
        const openai = createOpenAI({
            baseURL: joinUrl(endpoint, '/v1'),
            apiKey: apiKey,
        });
        return openai(model);
    }
}
