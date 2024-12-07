import { ChatOpenAI } from '@langchain/openai';
import { storeGet } from '@/backend/store';
import StrUtil from '@/common/utils/str-util';
import { joinUrl } from '@/common/utils/Util';
import { injectable } from 'inversify';
import ClientProviderService from '@/backend/services/ClientProviderService';


@injectable()
export default class AiProviderServiceImpl implements ClientProviderService<ChatOpenAI> {
    public getClient(): ChatOpenAI | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        let model = storeGet('model.gpt.default');
        if (StrUtil.isBlank(model)) {
            model = 'gpt-4o-mini';
        }
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            return null;
        }
        console.log(apiKey, endpoint);
        return new ChatOpenAI({
            modelName: model,
            temperature: 0.7,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: joinUrl(endpoint, '/v1')
            },
        });
    }
}
