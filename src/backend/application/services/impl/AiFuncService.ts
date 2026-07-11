import TtsService from '@/backend/application/services/TtsService';
import DpTaskService from '@/backend/application/services/DpTaskService';
import { TranscriptionService } from '@/backend/application/services/TranscriptionService';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import UrlUtil from '@/common/utils/UrlUtil';
import { inject, injectable } from 'inversify';
import { DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import ChatService from '@/backend/application/services/ChatService';
import { AiFuncFormatSplitPrompt } from '@/common/types/aiRes/AiFuncFormatSplit';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import { ParakeetModelService } from '@/backend/application/services/impl/ParakeetModelService';

@injectable()
export default class AiFuncService {
    private logger = getMainLogger('AiFuncService');

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ChatService)
    private chatService!: ChatService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.ParakeetModelService)
    private parakeetModelService!: ParakeetModelService;

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
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);

        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId: 0,
                status: DpTaskState.INIT,
                result: { message: '初始化...' },
            }],
        });

        const modelStatus = await this.parakeetModelService.getStatus();
        if (!modelStatus.ready) {
            this.logger.warn('Parakeet model not downloaded', { modelPath: modelStatus?.modelPath });
            this.rendererGateway.fireAndForget('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId: 0,
                    status: DpTaskState.FAILED,
                    result: {
                        error: '字幕模型尚未下载',
                        message: '请先到“设置中心 > 服务凭据”中下载字幕模型',
                    },
                }],
            });
            return;
        }

        this.localTranscriptionService.transcribe(filePath).catch((error) => {
            this.logger.error('Local transcription failed', { error: error instanceof Error ? error.message : String(error) });
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

            this.logger.warn('Transcription task does not exist', { filePath });
            return false;
        } catch (error) {
            this.logger.error('Error cancelling transcription task', { filePath, error });
            return false;
        }
    }
}
