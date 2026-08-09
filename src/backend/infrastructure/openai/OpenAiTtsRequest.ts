import fs from 'fs';
import os from 'node:os';
import path from 'path';

import axios from 'axios';

import UrlUtil from '@/common/utils/UrlUtil';
import { WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';
import StrUtil from '@/common/utils/str-util';

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

    @WithRateLimit('tts')
    public async invoke(): Promise<string> {
        const startedAt = Date.now();
        const charCount = this.str.length;
        const preview = StrUtil.preview(this.str);
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
            // 只记请求要点与摘要，不记录完整文本。
            this.logger.debug('openai tts request start', { charCount, preview });
            const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
            const tempDir = path.join(os.tmpdir(), 'dp/tts');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filename = this.str.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
            const outputPath = path.join(tempDir, filename);
            const bytes = Buffer.from(response.data).length;
            fs.writeFileSync(outputPath, Buffer.from(response.data), 'binary');
            this.logger.debug('openai tts request ok', { charCount, preview, durationMs: Date.now() - startedAt, bytes });
            return outputPath;
        } catch (error) {
            this.logger.error('openai tts request failed', { charCount, durationMs: Date.now() - startedAt, error });
            throw new Error('Failed to generate TTS');
        }
    }
}

export default OpenAiTtsRequest;
