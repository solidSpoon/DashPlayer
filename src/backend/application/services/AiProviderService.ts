import { LanguageModel } from 'ai';

export default interface AiProviderService {
    getModel(): LanguageModel | null;
}
