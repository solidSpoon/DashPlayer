import { storeGet } from '@/backend/store';
import fs from 'fs';
import axios from 'axios';
import UrlUtil from '@/common/utils/UrlUtil';
import dpLog from '@/backend/ioc/logger';
import StrUtil from '@/common/utils/str-util';
import path from 'path';
import os from 'node:os';
import {WaitRateLimit} from "@/common/utils/RateLimiter";

class OpenAiTtsRequest {
    private readonly apiKey: string;
    private readonly endpoint: string;
    private readonly str: string;

    constructor(str: string, apiKey: string, endpoint: string) {
        this.str = str;
        this.apiKey = apiKey;
        this.endpoint = endpoint;
    }

    public static build(str: string): OpenAiTtsRequest | null {
        const apiKey = storeGet('apiKeys.openAi.key');
        const endpoint = storeGet('apiKeys.openAi.endpoint');
        if (StrUtil.hasBlank(str, apiKey, endpoint)) {
            return null;
        }
        return new OpenAiTtsRequest(str, apiKey, endpoint);
    }

    @WaitRateLimit('tts')
    public async invoke() {
        const url = UrlUtil.joinWebUrl(this.endpoint, '/v1/audio/speech');
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
            'Content-Type': 'application/json',
            responseType: 'arraybuffer'
        };
        const data = {
            'model': 'tts-1',
            'input': this.str,
            'voice': 'alloy',
            'response_format': 'mp3'
        };

        try {
            const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
            const tempDir = path.join(os.tmpdir(), 'dp/tts');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filename = this.str.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
            const outputPath = path.join(tempDir, filename);
            fs.writeFileSync(outputPath, Buffer.from(response.data), 'binary');
            return outputPath;
        } catch (error) {
            dpLog.error(error);
            throw new Error('Failed to generate TTS');
        }
    }
}

export default OpenAiTtsRequest;
