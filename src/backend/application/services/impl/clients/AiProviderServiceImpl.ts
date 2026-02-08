import { storeGet } from '@/backend/infrastructure/settings/store';
import StrUtil from '@/common/utils/str-util';
import { joinUrl } from '@/common/utils/Util';
import { inject, injectable } from 'inversify';
import AiProviderService, { AiModelScene } from '@/backend/application/services/AiProviderService';
import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';
import ModelRoutingService from '@/backend/application/services/ModelRoutingService';
import TYPES from '@/backend/ioc/types';


@injectable()
export default class AiProviderServiceImpl implements AiProviderService {
    @inject(TYPES.ModelRoutingService)
    private modelRoutingService!: ModelRoutingService;

    public getModel(scene: AiModelScene): LanguageModel | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        const routedModel = this.modelRoutingService.resolveOpenAiModel(scene);
        if (StrUtil.hasBlank(apiKey, endpoint)) {
            return null;
        }
        if (!routedModel || StrUtil.isBlank(routedModel.modelId)) {
            return null;
        }
        const openai = createOpenAI({
            baseURL: joinUrl(endpoint, '/v1'),
            apiKey: apiKey,
        });
        return openai(routedModel.modelId);
    }
}
