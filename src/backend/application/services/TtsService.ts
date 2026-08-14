import StrUtil from '@/common/utils/str-util';
import {storeGet} from '@/backend/infrastructure/settings/store';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import axios from 'axios';
import path from 'path';
import * as os from 'node:os';
import fs from 'fs';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { WithRateLimit } from '@/backend/application/kernel/concurrency/decorators';

const logger = getMainLogger('TtsService');

class TtsService {

    static joinUrl = (base: string, path2: string) => {
        return base.replace(/\/+$/, '') + '/' + path2.replace(/^\/+/, '');
    };

    @WithRateLimit('tts')
    public static async tts(str: string) {
        if (StrUtil.isBlank(storeGet('apiKeys.openAi.key')) || StrUtil.isBlank(storeGet('apiKeys.openAi.endpoint'))) {
            throw new Error('OpenAI API key or endpoint is not set');
        }
        const startedAt = Date.now();
        const charCount = str.length;
        const preview = StrUtil.preview(str);
        const url = this.joinUrl(
            resolveOpenAiBaseUrl(storeGet('apiKeys.openAi.endpoint'), storeGet('apiKeys.openAi.autoAppendV1')),
            '/audio/speech'
        );
        const headers = {
            'Authorization': `Bearer ${storeGet('apiKeys.openAi.key')}`,
            'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
            'Content-Type': 'application/json',
            responseType: 'arraybuffer'
        };
        const data = {
            'model': 'tts-1',
            'input': str,
            'voice': 'alloy',
            'response_format': 'mp3'
        };

        try {
            // 只记请求要点与摘要，不记录完整文本。
            logger.debug('tts request start', { charCount, preview });
            const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
            const tempDir = path.join(os.tmpdir(), 'dp/tts');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filename = str.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
            const outputPath = path.join(tempDir, filename);
            const bytes = Buffer.from(response.data).length;
            fs.writeFileSync(outputPath, Buffer.from(response.data), 'binary');
            logger.debug('tts request ok', { charCount, preview, durationMs: Date.now() - startedAt, bytes });
            return outputPath;
        } catch (error) {
            logger.error('tts request failed', { charCount, durationMs: Date.now() - startedAt, error });
            throw new Error('Failed to generate TTS');
        }
    }
}

export default TtsService;
