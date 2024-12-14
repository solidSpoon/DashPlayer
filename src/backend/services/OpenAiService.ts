import { TranscriptionVerbose } from 'openai/src/resources/audio/transcriptions';
import OpenAI from 'openai';

export interface OpenAiService {
    whisper(file: string): Promise<TranscriptionVerbose>;
    getOpenAi(): OpenAI;
}
