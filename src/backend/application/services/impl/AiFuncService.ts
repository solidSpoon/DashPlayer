import TtsService from '@/backend/application/services/TtsService';
import DpTaskService from '@/backend/application/services/DpTaskService';
import SettingService from '@/backend/application/services/SettingService';
import { TranscriptionService } from '@/backend/application/services/TranscriptionService';
import { SettingsStore } from '@/backend/application/ports/gateways/SettingsStore';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import LocationUtil from '@/backend/utils/LocationUtil';
import UrlUtil from '@/common/utils/UrlUtil';
import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import { DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import ChatService from '@/backend/application/services/ChatService';
import { AiFuncFormatSplitPrompt } from '@/common/types/aiRes/AiFuncFormatSplit';

@injectable()
export default class AiFuncService {
    private logger = getMainLogger('AiFuncService');

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ChatService)
    private chatService!: ChatService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.SettingService)
    private settingService!: SettingService;

    @inject(TYPES.SettingsStore)
    private settingsStore!: SettingsStore;

    @inject(TYPES.CloudTranscriptionService)
    private cloudTranscriptionService!: TranscriptionService;

    @inject(TYPES.LocalTranscriptionService)
    private localTranscriptionService!: TranscriptionService;

    public async formatSplit(text: string): Promise<number> {
        const taskId = await this.dpTaskService.create();
        this.chatService.chat(taskId, [{
            role: 'user',
            content: AiFuncFormatSplitPrompt.promptFunc(text),
        }]).then();
        return taskId;
    }

    public async tts(text: string): Promise<string> {
        return UrlUtil.toUrl(await TtsService.tts(text));
    }

    public async transcript(params: { filePath: string }): Promise<void> {
        const { filePath } = params;
        this.logger.info('Transcription task started', { filePath });

        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId: 0,
                status: DpTaskState.INIT,
                result: { message: '初始化...' },
            }],
        });

        const transcriptionEngine = await this.settingService.getCurrentTranscriptionProvider();
        const modelSize = this.settingsStore.get('whisper.modelSize') === 'large' ? 'large' : 'base';
        const modelTag = modelSize === 'large' ? 'large-v3' : 'base';
        const modelPath = path.join(LocationUtil.staticGetStoragePath('models'), 'whisper', `ggml-${modelTag}.bin`);
        const modelDownloaded = fs.existsSync(modelPath);

        let transcriptionService: TranscriptionService;
        let serviceName = '';

        if (transcriptionEngine === 'whisper' && modelDownloaded) {
            transcriptionService = this.localTranscriptionService;
            serviceName = 'Local';
            this.logger.info('Using local transcription service');
        } else if (transcriptionEngine === 'whisper' && !modelDownloaded) {
            this.logger.warn('Whisper model not downloaded', { modelSize, modelPath });
            this.rendererGateway.fireAndForget('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId: 0,
                    status: DpTaskState.FAILED,
                    result: { error: `本地 Whisper 模型未下载：${modelSize}。请到设置页面下载模型后再转录。` },
                }],
            });
            return;
        } else if (transcriptionEngine === 'openai') {
            transcriptionService = this.cloudTranscriptionService;
            serviceName = 'Cloud';
            this.logger.info('Using cloud transcription service');
        } else {
            this.logger.warn('No transcription service enabled');
            this.rendererGateway.fireAndForget('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId: 0,
                    status: DpTaskState.FAILED,
                    result: { error: '未启用任何转录服务' },
                }],
            });
            return;
        }

        transcriptionService.transcribe(filePath).catch((error) => {
            this.logger.error(`${serviceName} transcription failed`, { error: error instanceof Error ? error.message : String(error) });
        });
    }

    public async cancelTranscription(params: { filePath: string }): Promise<boolean> {
        const { filePath } = params;
        this.logger.info('Cancelling transcription task', { filePath });

        try {
            const localSuccess = this.localTranscriptionService.cancel(filePath);
            if (localSuccess) {
                this.logger.info('Local transcription task cancelled successfully', { filePath });
                return true;
            }

            const cloudSuccess = this.cloudTranscriptionService.cancel(filePath);
            if (cloudSuccess) {
                this.logger.info('Cloud transcription task cancelled successfully', { filePath });
                return true;
            }

            this.logger.warn('Transcription task does not exist', { filePath });
            return false;
        } catch (error) {
            this.logger.error('Error cancelling transcription task', { filePath, error });
            return false;
        }
    }
}
