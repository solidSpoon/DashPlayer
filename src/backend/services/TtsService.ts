import StrUtil from '@/common/utils/str-util';
import { storeGet } from '@/backend/store';
import axios from 'axios';
import path from 'path';
import * as os from 'node:os';
import fs from 'fs';
import dpLog from '@/backend/ioc/logger';
import {WaitRateLimit} from "@/common/utils/RateLimiter";
import { EdgeTTS } from 'node-edge-tts';

class TtsService {
    static joinUrl = (base: string, path2: string) => {
        return base.replace(/\/+$/, '') + '/' + path2.replace(/^\/+/, '');
    };

    @WaitRateLimit('tts')
    public static async tts(str: string) {
        const provider = storeGet('tts.provider') || 'edge-tts';

        if (provider === 'openai') {
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
                const filename = str.replace(/[^a-zA-Z0-9]/g, '_') + '_openai.mp3';
                const outputPath = path.join(tempDir, filename);
                fs.writeFileSync(outputPath, Buffer.from(response.data), 'binary');
                return outputPath;
            } catch (error) {
                dpLog.error(error);
                throw new Error('Failed to generate TTS');
            }
        } else if (provider === 'edge-tts') {
            try {
                const voice = storeGet('tts.edgeTts.voice') || 'en-US-JennyNeural';
                const tempDir = path.join(os.tmpdir(), 'dp/tts');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const filename = str.replace(/[^a-zA-Z0-9]/g, '_') + '_edge.mp3';
                const outputPath = path.join(tempDir, filename);

                const tts = new EdgeTTS({ voice });
                await tts.ttsPromise(str, outputPath);

                return outputPath;
            } catch (error) {
                dpLog.error(error);
                throw new Error('Failed to generate TTS with Edge-TTS');
            }
        } else {
            throw new Error('Unknown TTS provider');
        }
    }

    public static async getEdgeTtsVoices(forceRefresh: boolean = false): Promise<any[]> {
        const STORAGE_KEY = 'edgeTtsVoices';
        const TIMESTAMP_KEY = 'edgeTtsVoicesTimestamp';
        const CACHE_DURATION = 24 * 60 * 60 * 1000;

        const cachedData = storeGet(STORAGE_KEY);
        const cachedTimestamp = parseInt(storeGet(TIMESTAMP_KEY) || '0');
        const now = Date.now();

        if (!forceRefresh && cachedData && cachedTimestamp && (now - cachedTimestamp) < CACHE_DURATION) {
            dpLog.info('Using cached Edge-TTS voices');
            return JSON.parse(cachedData);
        }

        try {
            dpLog.info(forceRefresh ? 'Force refreshing Edge-TTS voices' : 'Fetching Edge-TTS voices');
            const url = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';
            const response = await axios.get(url);
            const voices = response.data;

            if (voices && voices.length > 0) {
                const fs = require('fs');
                const path = require('path');

                const userDataPath = require('electron').app.getPath('userData');
                const voicesFile = path.join(userDataPath, 'edge-tts-voices.json');
                const timestampFile = path.join(userDataPath, 'edge-tts-voices-timestamp.txt');

                fs.writeFileSync(voicesFile, JSON.stringify(voices), 'utf-8');
                fs.writeFileSync(timestampFile, now.toString(), 'utf-8');

                dpLog.info(`Saved ${voices.length} Edge-TTS voices to cache`);
            }

            return voices;
        } catch (error) {
            dpLog.error(error);

            if (!forceRefresh && cachedData) {
                dpLog.info('Using cached data due to fetch error');
                return JSON.parse(cachedData);
            }

            throw new Error('Failed to get Edge-TTS voices');
        }
    }

}

export default TtsService;
