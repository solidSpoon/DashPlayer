import fs from 'fs';
import os from 'node:os';
import path from 'path';

import axios from 'axios';

import UrlUtil from '@/common/utils/UrlUtil';
import { WaitRateLimit } from '@/common/utils/RateLimiter';

import { getMainLogger } from '@/backend/infrastructure/logger';

export type OpenAiTtsConfig = {
    apiKey: string;
    endpoint: string;
};

class OpenAiTtsRequest {
    private readonly logger = getMainLogger('OpenAiTtsRequest');
    private readonly apiKey: string;
    private readonly endpoint: string;
    private readonly str: string;

    constructor(str: string, config: OpenAiTtsConfig) {
        this.str = str;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
    }

    @WaitRateLimit('tts')
    public async invoke(): Promise<string> {
        const url = UrlUtil.joinWebUrl(this.endpoint, '/v1/audio/speech');
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
            'Content-Type': 'application/json',
            responseType: 'arraybuffer',
        };
        const data = {
            model: 'tts-1',
            input: this.str,
            voice: 'alloy',
            response_format: 'mp3',
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
            this.logger.error('openai tts request failed', { error });
            throw new Error('Failed to generate TTS');
        }
    }
}

export default OpenAiTtsRequest;
