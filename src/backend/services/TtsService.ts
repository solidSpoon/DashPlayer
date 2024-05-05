import { strBlank } from '@/common/utils/Util';
import { storeGet } from '@/backend/store';
import axios from 'axios';
import path from 'path';
import * as os from 'node:os';
import fs from 'fs';
import RateLimiter from "@/common/utils/RateLimiter";

class TtsService {
    static joinUrl = (base: string, path2: string) => {
        return base.replace(/\/+$/, '') + '/' + path2.replace(/^\/+/, '');
    };

    // ...
    public static async tts(str: string) {
        if (strBlank(storeGet('apiKeys.openAi.key')) || strBlank(storeGet('apiKeys.openAi.endpoint'))) {
            return null;
        }
        RateLimiter.wait('tts')
        const url = this.joinUrl(storeGet('apiKeys.openAi.endpoint'), '/v1/audio/speech');
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
            const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
            const tempDir = path.join(os.tmpdir(), 'dp/tts');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const filename = str.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
            const outputPath = path.join(tempDir, filename);
            fs.writeFileSync(outputPath, Buffer.from(response.data), 'binary');
            return outputPath;
        } catch (error) {
            console.log(error);
        }
    }

}

export default TtsService;
