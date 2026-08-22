import { injectable } from 'inversify';
import { storeGet } from '@/backend/infrastructure/settings/store';
import { AiModelScene } from '@/backend/services/AiProviderService';
import { SettingKey } from '@/common/types/store_schema';

export type RoutedModel = {
    providerId: 'openai';
    modelId: string;
    fullModelId: string;
};

export default interface ModelRoutingService {
    resolveOpenAiModel(scene: AiModelScene): RoutedModel | null;
}


@injectable()
export class ModelRoutingServiceImpl implements ModelRoutingService {
    /**
     * 将 AI 使用场景映射到对应的模型设置键。
     * @param scene 当前 AI 使用场景。
     * @returns 该场景保存模型标识的设置键。
     */
    private resolveFeatureKey(scene: AiModelScene): string {
        if (scene === 'sentenceLearning') {
            return 'models.openai.sentenceLearning';
        }
        if (scene === 'subtitleTranslation') {
            return 'models.openai.subtitleTranslation';
        }
        return 'models.openai.dictionary';
    }

    /**
     * 解析服务配置中的 OpenAI 模型清单。
     * @param raw 逗号或换行分隔的模型配置。
     * @returns 去空、去重后的模型标识列表；空配置保持为空，不做默认模型回退。
     */
    private parseModels(raw: string): string[] {
        const parsed = raw
            .split(/[\n,]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        return Array.from(new Set(parsed));
    }

    /**
     * 解析场景当前选择的 OpenAI 模型，并严格校验它仍在服务配置清单中。
     * @param scene 当前 AI 使用场景。
     * @returns 已校验的模型路由；配置缺失或失效时直接抛错。
     */
    public resolveOpenAiModel(scene: AiModelScene): RoutedModel | null {
        const availableModels = this.parseModels(storeGet('models.openai.available'));
        if (availableModels.length === 0) {
            throw new Error('OpenAI 可用模型列表为空，请先在服务配置中添加模型');
        }
        const modelKey = this.resolveFeatureKey(scene) as SettingKey;
        const selectedModel = storeGet(modelKey);
        if (!availableModels.includes(selectedModel)) {
            throw new Error(`当前模型未在服务配置中启用: ${selectedModel}`);
        }

        return {
            providerId: 'openai',
            modelId: selectedModel,
            fullModelId: `openai:${selectedModel}`,
        };
    }
}
