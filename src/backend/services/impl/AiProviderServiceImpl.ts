import { ChatOpenAI } from '@langchain/openai';
import { storeGet } from '@/backend/store';
import StrUtil from '@/common/utils/str-util';
import { joinUrl } from '@/common/utils/Util';
import AiProviderService from '@/backend/services/AiProviderService';
import { injectable } from 'inversify';


@injectable()
export default class AiProviderServiceImpl implements AiProviderService {
    public getOpenAi(): ChatOpenAI {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        let model = storeGet('model.gpt.default');
        if (StrUtil.isBlank(model)) {
            model = 'gpt-4o-mini';
        }
        console.log(apiKey, endpoint);
        return new ChatOpenAI({
            modelName: model,
            temperature: 0.7,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: joinUrl(endpoint, '/v1')
            }
        });
    }
}
