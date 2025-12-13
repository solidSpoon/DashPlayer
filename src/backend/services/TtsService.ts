import StrUtil from '@/common/utils/str-util';
import { storeGet } from '@/backend/store';
import axios from 'axios';
import path from 'path';
import * as os from 'node:os';
import fs from 'fs';
import dpLog from '@/backend/ioc/logger';
import {WaitRateLimit} from "@/common/utils/RateLimiter";
import LocationUtil from '@/backend/utils/LocationUtil';

class TtsService {
    static joinUrl = (base: string, path2: string) => {
        return base.replace(/\/+$/, '') + '/' + path2.replace(/^\/+/, '');
    };

    private static envLock: Promise<void> = Promise.resolve();

    private static async withEnvLock<T>(task: () => Promise<T>): Promise<T> {
        const previous = this.envLock;
        let release: (() => void) | null = null;
        this.envLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;
        try {
            return await task();
        } finally {
            release?.();
        }
    }

    private static async withEchogardenHome<T>(homeDir: string, task: () => Promise<T>): Promise<T> {
        return this.withEnvLock(async () => {
            const prevHome = process.env.HOME;
            const prevUserProfile = process.env.USERPROFILE;
            const prevHomeDrive = process.env.HOMEDRIVE;
            const prevHomePath = process.env.HOMEPATH;

            process.env.HOME = homeDir;
            process.env.USERPROFILE = homeDir;
            process.env.HOMEDRIVE = '';
            process.env.HOMEPATH = '';

            try {
                return await task();
            } finally {
                if (prevHome === undefined) delete process.env.HOME;
                else process.env.HOME = prevHome;

                if (prevUserProfile === undefined) delete process.env.USERPROFILE;
                else process.env.USERPROFILE = prevUserProfile;

                if (prevHomeDrive === undefined) delete process.env.HOMEDRIVE;
                else process.env.HOMEDRIVE = prevHomeDrive;

                if (prevHomePath === undefined) delete process.env.HOMEPATH;
                else process.env.HOMEPATH = prevHomePath;
            }
        });
    }

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
            const modelsRoot = LocationUtil.staticGetStoragePath('models');
            const echogardenHomeDir = path.join(modelsRoot, 'echogarden-home');

            if (!fs.existsSync(echogardenHomeDir)) {
                fs.mkdirSync(echogardenHomeDir, { recursive: true });
            }

            const { audio } = await this.withEchogardenHome(echogardenHomeDir, async () => {
                const Echogarden = await import('echogarden');

                // 使用 echogarden 进行本地 TTS
                return await Echogarden.synthesize(
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
            });

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
            dpLog.error('Failed to generate local TTS with echogarden', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new Error('Failed to generate local TTS (echogarden model download may have failed)');
        }
    }
}

export default TtsService;
