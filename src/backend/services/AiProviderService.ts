import { ChatOpenAI } from '@langchain/openai';


export default interface AiProviderService {
    getOpenAi(): ChatOpenAI | null;
}
