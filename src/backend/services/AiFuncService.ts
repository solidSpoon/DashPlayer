import LocalTtsService from '@/backend/services/LocalTtsService';
import DpTaskService from '@/backend/services/DpTaskService';
import { TranscriptionService } from '@/backend/services/TranscriptionService';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import UrlUtil from '@/common/utils/UrlUtil';
import { inject, injectable } from 'inversify';
import ChatService from '@/backend/services/ChatService';
import { AiFuncFormatSplitPrompt } from '@/common/types/aiRes/AiFuncFormatSplit';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import ParakeetModelService from '@/backend/services/ParakeetModelService';
import {
    TranscriptTask,
    TranscriptTaskResult,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';

/**
 * AiFuncService 的业务契约。
 */
export default interface AiFuncService {
    formatSplit(text: string): Promise<number>;

    tts(text: string): Promise<string>;

    listTranscriptionTasks(): Promise<TranscriptTask[]>;

    enqueueTranscription(params: { filePath: string }): Promise<TranscriptTask>;

    removeTranscription(params: { filePath: string }): Promise<void>;

    transcript(params: { filePath: string }): Promise<'started' | 'model_missing'>;

    cancelTranscription(params: { filePath: string }): Promise<boolean>;
}



/**
 * 编排 AI 功能，并将转录列表与状态统一交给后端持久化服务管理。
 */
@injectable()
export class AiFuncServiceImpl implements AiFuncService {
    private logger = getMainLogger('AiFuncService');

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ChatService)
    private chatService!: ChatService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.ParakeetModelService)
    private parakeetModelService!: ParakeetModelService;

    @inject(TYPES.LocalTranscriptionService)
    private localTranscriptionService!: TranscriptionService;

    @inject(TYPES.LocalTtsService)
    private localTtsService!: LocalTtsService;

    public async formatSplit(text: string): Promise<number> {
        const taskId = await this.dpTaskService.create();
        this.chatService.chat(taskId, [{
            role: 'user',
            content: AiFuncFormatSplitPrompt.promptFunc(text),
        }]).then();
        return taskId;
    }

    public async tts(text: string): Promise<string> {
        return UrlUtil.toUrl(await this.localTtsService.synthesize(text));
    }

    /**
     * 查询后端持久化的转录任务列表。
     *
     * @returns 当前全部转录任务。
     */
    public listTranscriptionTasks(): Promise<TranscriptTask[]> {
        return this.localTranscriptionService.listTasks();
    }

    /**
     * 将媒体文件加入后端转录队列，重复路径返回已有任务。
     *
     * @param params 待加入队列的媒体路径。
     * @returns 新建或已存在的转录任务。
     */
    public enqueueTranscription(params: { filePath: string }): Promise<TranscriptTask> {
        return this.localTranscriptionService.enqueue(params.filePath);
    }

    /**
     * 删除未执行中的转录任务。
     *
     * @param params 要删除的媒体路径。
     */
    public removeTranscription(params: { filePath: string }): Promise<void> {
        return this.localTranscriptionService.remove(params.filePath);
    }

    /**
     * 启动指定媒体的转录任务，并将状态写入后端任务表。
     *
     * @param params 待转录的媒体路径。
     * @returns 模型缺失时返回 model_missing，否则返回 started。
     */
    public async transcript(params: { filePath: string }): Promise<'started' | 'model_missing'> {
        const { filePath } = params;
        this.logger.info('Transcription task started', { filePath });
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        await this.localTranscriptionService.enqueue(filePath);

        const modelStatus = await this.parakeetModelService.getStatus();
        if (!modelStatus.ready) {
            this.logger.warn('Parakeet model not downloaded', { modelPath: modelStatus?.modelPath });
            const result: TranscriptTaskResult = {
                error: '字幕模型尚未下载',
                message: '请先到“设置中心 > 服务凭据”中下载字幕模型',
            };
            await this.localTranscriptionService.updateTask(filePath, TranscriptTaskState.FAILED, result);
            return 'model_missing';
        }

        this.localTranscriptionService.transcribe(filePath).catch((error) => {
            this.logger.error('Local transcription failed', { error: error instanceof Error ? error.message : String(error) });
        });
        return 'started';
    }

    public async cancelTranscription(params: { filePath: string }): Promise<boolean> {
        const { filePath } = params;
        this.logger.info('Cancelling transcription task', { filePath });

        const localSuccess = this.localTranscriptionService.cancel(filePath);
        if (localSuccess) {
            this.logger.info('Local transcription task cancelled successfully', { filePath });
            return true;
        }

        this.logger.warn('Transcription task does not exist', { filePath });
        return false;
    }
}
