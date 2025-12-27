import { LanguageModelV1 } from 'ai';

export default interface AiProviderService {
    getModel(): LanguageModelV1 | null;
}
