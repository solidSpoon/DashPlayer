import { LanguageModel } from 'ai';

export type AiModelScene = 'sentenceLearning' | 'subtitleTranslation' | 'dictionary';

export default interface AiProviderService {
    getModel(scene: AiModelScene): LanguageModel | null;
}
