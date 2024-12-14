import { OpenAiService } from '@/backend/services/OpenAiService';
import OpenAI from 'openai';
import { injectable } from 'inversify';
import { storeGet } from '@/backend/store';
import StrUtil from '@/common/utils/str-util';
import fs from "fs";
import { TranscriptionVerbose } from 'openai/src/resources/audio/transcriptions';
@injectable()
export class OpenAIServiceImpl implements OpenAiService {
    private openai: OpenAI | null = null;
    private apiKey: string | null = null;
    private endpoint: string | null = null;


    public getOpenAi(): OpenAI {
        const ak = storeGet('apiKeys.openAi.key');
        const ep = storeGet('apiKeys.openAi.endpoint');
        if (StrUtil.hasBlank(ak, ep)) {
            throw new Error('未设置 OpenAI 密钥');
        }
        if (this.openai && this.apiKey === ak && this.endpoint === ep) {
            return this.openai;
        }
        this.apiKey = ak;
        this.endpoint = ep;
        this.openai = new OpenAI({
            baseURL: ep + '/v1',
            apiKey: ak
        });
        return this.openai;
    }

    public async whisper(file: string, signal?: AbortSignal): Promise<TranscriptionVerbose> {
        const openAi = this.getOpenAi();
        if (!openAi) {
            return Promise.reject('未设置 OpenAI 密钥');
        }
        const transcription = await openAi.audio.transcriptions.create({
            file: fs.createReadStream(file),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"]
        });
        return transcription;
    }
}
