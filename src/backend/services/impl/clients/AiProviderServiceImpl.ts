import {storeGet} from '@/backend/infrastructure/settings/store';
import StrUtil from '@/common/utils/str-util';
import { joinUrl } from '@/common/utils/Util';
import { injectable } from 'inversify';
import AiProviderService from '@/backend/services/AiProviderService';
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModelV1 } from 'ai';


@injectable()
export default class AiProviderServiceImpl implements AiProviderService {

    public getModel():LanguageModelV1 | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        let model = storeGet('model.gpt.default');
        if (StrUtil.isBlank(model)) {
            model = 'gpt-4o-mini';
        }
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            return null;
        }
        const openai = createOpenAI({
            compatibility: 'compatible',
            baseURL: joinUrl(endpoint, '/v1'),
            apiKey: apiKey
        });
        return openai(model);
    }
}
