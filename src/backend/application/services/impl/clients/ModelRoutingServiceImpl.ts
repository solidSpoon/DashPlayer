import { injectable } from 'inversify';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { AiModelScene } from '@/backend/application/services/AiProviderService';
import ModelRoutingService, { RoutedModel } from '@/backend/application/services/ModelRoutingService';
import { SettingKey } from '@/common/types/store_schema';

@injectable()
export default class ModelRoutingServiceImpl implements ModelRoutingService {
    private static readonly DEFAULT_MODEL = 'gpt-4o-mini';

    private resolveFeatureKey(scene: AiModelScene): string {
        if (scene === 'sentenceLearning') {
            return 'models.openai.sentenceLearning';
        }
        if (scene === 'subtitleTranslation') {
            return 'models.openai.subtitleTranslation';
        }
        return 'models.openai.dictionary';
    }

    private parseModels(raw: string): string[] {
        const parsed = raw
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        const deduped = Array.from(new Set(parsed));
        if (deduped.length === 0) {
            return [ModelRoutingServiceImpl.DEFAULT_MODEL];
        }
        return deduped;
    }

    public resolveOpenAiModel(scene: AiModelScene): RoutedModel | null {
        const availableModels = this.parseModels(storeGet('models.openai.available'));
        const modelKey = this.resolveFeatureKey(scene) as SettingKey;
        const selectedModel = storeGet(modelKey);

        const modelId = availableModels.includes(selectedModel)
            ? selectedModel
            : (availableModels[0] ?? ModelRoutingServiceImpl.DEFAULT_MODEL);

        if (!modelId) {
            return null;
        }

        return {
            providerId: 'openai',
            modelId,
            fullModelId: `openai:${modelId}`,
        };
    }
}
