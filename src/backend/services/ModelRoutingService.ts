import { AiModelScene } from '@/backend/services/AiProviderService';

export type RoutedModel = {
    providerId: 'openai';
    modelId: string;
    fullModelId: string;
};

export default interface ModelRoutingService {
    resolveOpenAiModel(scene: AiModelScene): RoutedModel | null;
}
