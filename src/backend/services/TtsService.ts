import StrUtil from '@/common/utils/str-util';
import { storeGet } from '@/backend/store';
import axios from 'axios';
import path from 'path';
import * as os from 'node:os';
import fs from 'fs';
import dpLog from '@/backend/ioc/logger';
import {WaitRateLimit} from "@/common/utils/RateLimiter";

class TtsService {
    static joinUrl = (base: string, path2: string) => {
        return base.replace(/\/+$/, '') + '/' + path2.replace(/^\/+/, '');
    };

    @WaitRateLimit('tts')
    public static async tts(str: string) {
        if (StrUtil.isBlank(storeGet('apiKeys.openAi.key')) || StrUtil.isBlank(storeGet('apiKeys.openAi.endpoint'))) {
            throw new Error('OpenAI API key or endpoint is not set');
        }
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
            dpLog.error(error);
            throw new Error('Failed to generate TTS');
        }
    }

  public static async ttsLocal(str: string) {
        try {
            const Echogarden = await import('echogarden');
            
            // 使用 echogarden 进行本地 TTS
            const { audio } = await Echogarden.synthesize(
                str,
                {
                    engine: 'kokoro',  // 使用 kokoro 引擎，高质量离线 TTS
                    language: 'en-US', // 英语美音
                    voice: 'Alloy',     // 音色
                    speed: 1.0,         // 语速
                    pitch: 1.0,        // 音高
                    splitToSentences: true, // 按句子切分
                    outputAudioFormat: { codec: 'mp3', bitrate: 64000 } // 输出格式
                }
            );

            // 创建临时目录
            const tempDir = path.join(os.tmpdir(), 'dp/tts');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // 生成文件名
            const filename = str.replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
            const outputPath = path.join(tempDir, filename);

            // 写入文件
            fs.writeFileSync(outputPath, Buffer.from(audio as Buffer));

            dpLog.info('Local TTS generated successfully', { text: str, outputPath });
            return outputPath;
        } catch (error) {
            dpLog.error('Failed to generate local TTS with echogarden', error);
            throw new Error('Failed to generate local TTS');
        }
    }
}

export default TtsService;
