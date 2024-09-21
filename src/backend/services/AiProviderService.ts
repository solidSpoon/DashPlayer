import { ChatOpenAI } from '@langchain/openai';


export default interface AiProviderService {
    getOpenAi(): Promise<ChatOpenAI | null>;
}
