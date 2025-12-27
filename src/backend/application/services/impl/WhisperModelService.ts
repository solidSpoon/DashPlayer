import SystemConfigService from '@/backend/application/services/SystemConfigService';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import LocationUtil from '@/backend/utils/LocationUtil';
import { WHISPER_MODEL_DOWNLOADED_KEY } from '@/common/constants/systemConfigKeys';
import { WhisperModelSize, WhisperModelStatusVO, WhisperVadModel } from '@/common/types/vo/whisper-model-vo';
import axios from 'axios';
import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

@injectable()
export class WhisperModelService {
    @inject(TYPES.RendererGateway) private rendererGateway!: RendererGateway;
    @inject(TYPES.SystemConfigService) private systemConfigService!: SystemConfigService;
    private logger = getMainLogger('WhisperModelService');

    private getModelsRoot(): string {
        return LocationUtil.staticGetStoragePath('models');
    }

    private getWhisperModelPath(size: WhisperModelSize): string {
        const modelsRoot = this.getModelsRoot();
        const tag = size === 'large' ? 'large-v3' : 'base';
        return path.join(modelsRoot, 'whisper', `ggml-${tag}.bin`);
    }

    private getVadModelPath(vadModel: WhisperVadModel): string {
        const modelsRoot = this.getModelsRoot();
        return path.join(modelsRoot, 'whisper-vad', `ggml-${vadModel}.bin`);
    }

    public async getStatus(): Promise<WhisperModelStatusVO> {
        const modelsRoot = this.getModelsRoot();
        const basePath = this.getWhisperModelPath('base');
        const largePath = this.getWhisperModelPath('large');
        const v5Path = this.getVadModelPath('silero-v5.1.2');
        const v6Path = this.getVadModelPath('silero-v6.2.0');

        const whisperModelDownloaded = fs.existsSync(basePath) || fs.existsSync(largePath);
        await this.systemConfigService.setValue(WHISPER_MODEL_DOWNLOADED_KEY, whisperModelDownloaded ? 'true' : 'false');

        return {
            modelsRoot,
            whisper: {
                base: { exists: fs.existsSync(basePath), path: basePath },
                large: { exists: fs.existsSync(largePath), path: largePath },
            },
            vad: {
                'silero-v5.1.2': { exists: fs.existsSync(v5Path), path: v5Path },
                'silero-v6.2.0': { exists: fs.existsSync(v6Path), path: v6Path },
            },
        };
    }

    private async downloadFile(url: string, destPath: string, progressKey: string): Promise<void> {
        if (fs.existsSync(destPath)) return;

        await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
        const tempPath = `${destPath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const response = await axios.get(url, { responseType: 'stream' });
        const total = Number(response.headers['content-length'] ?? 0) || 0;

        await new Promise<void>((resolve, reject) => {
            const writer = fs.createWriteStream(tempPath);
            let downloaded = 0;
            let lastEmittedPercent = -1;
            let lastEmitAt = 0;

            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                if (!total) return;
                const percent = Math.max(0, Math.min(100, Math.floor((downloaded / total) * 100)));
                const now = Date.now();
                if (percent === lastEmittedPercent && now - lastEmitAt < 500) return;
                lastEmittedPercent = percent;
                lastEmitAt = now;
                this.rendererGateway.fireAndForget('settings/whisper-model-download-progress', {
                    key: progressKey,
                    percent,
                    downloaded,
                    total,
                });
            });

            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        await fsPromises.rename(tempPath, destPath);
        this.rendererGateway.fireAndForget('settings/whisper-model-download-progress', {
            key: progressKey,
            percent: 100,
            downloaded: total || undefined,
            total: total || undefined,
        });
    }

    public async downloadWhisperModel(params: { modelSize: WhisperModelSize }): Promise<{ success: boolean; message: string }> {
        const size: WhisperModelSize = params.modelSize === 'large' ? 'large' : 'base';
        const tag = size === 'large' ? 'large-v3' : 'base';
        const modelPath = this.getWhisperModelPath(size);
        const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${tag}.bin`;

        this.logger.info('download whisper model', { size, modelPath });
        await this.downloadFile(url, modelPath, `whisper:${size}`);
        await this.systemConfigService.setValue(WHISPER_MODEL_DOWNLOADED_KEY, 'true');
        return { success: true, message: `模型已下载：${size}` };
    }

    public async downloadVadModel(params: { vadModel: WhisperVadModel }): Promise<{ success: boolean; message: string }> {
        const vadModel: WhisperVadModel = params.vadModel === 'silero-v5.1.2' ? 'silero-v5.1.2' : 'silero-v6.2.0';
        const modelPath = this.getVadModelPath(vadModel);
        const url = `https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-${vadModel}.bin`;

        this.logger.info('download whisper vad model', { vadModel, modelPath });
        await this.downloadFile(url, modelPath, `vad:${vadModel}`);
        return { success: true, message: `静音检测模型已下载：${vadModel}` };
    }
}
