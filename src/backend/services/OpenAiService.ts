import OpenAI from 'openai';

export interface OpenAiService {
    getOpenAi(): OpenAI;
}
