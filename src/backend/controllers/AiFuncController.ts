import TtsService from '@/backend/services/TtsService';
import registerRoute from '@/common/api/register';
import AiServiceImpl from '@/backend/services/AiServiceImpl';
import ChatServiceImpl from '@/backend/services/impl/ChatServiceImpl';
import UrlUtil from '@/common/utils/UrlUtil';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/services/DpTaskService';
import WhisperService from '@/backend/services/WhisperService';
import RendererGateway from '@/backend/services/RendererGateway';
import { CoreMessage } from 'ai';
import SettingService from "@/backend/services/SettingService";
import { getMainLogger } from '@/backend/ioc/simple-logger';
import { TranscriptionService } from '@/backend/services/TranscriptionService';
import { DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import * as fs from 'fs';
import * as path from 'path';
import LocationUtil from '@/backend/utils/LocationUtil';

@injectable()
export default class AiFuncController implements Controller {

    private logger = getMainLogger('AiFuncController');

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ChatService)
    private chatService!: ChatServiceImpl

    @inject(TYPES.AiService)
    private aiService!: AiServiceImpl

    @inject(TYPES.WhisperService)
    private whisperService!: WhisperService;


    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.SettingService)
    private settingService!: SettingService;

    @inject(TYPES.CloudTranscriptionService)
    private cloudTranscriptionService!: TranscriptionService;

    @inject(TYPES.LocalTranscriptionService)
    private localTranscriptionService!: TranscriptionService;

    public async analyzeNewWords(sentence: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.analyzeWord(taskId, sentence).then();
        return taskId;
    }

    public async analyzeNewPhrases(sentence: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.analyzePhrase(taskId, sentence).then();
        return taskId;
    }

    public async analyzeGrammars(sentence: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.analyzeGrammar(taskId, sentence).then();
        return taskId;
    }

    public async makeSentences({ sentence, point }: { sentence: string, point: string[] }) {
        const taskId = await this.dpTaskService.create();
        this.aiService.makeSentences(taskId, sentence, point).then();
        return taskId;
    }

    public async polish(sentence: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.polish(taskId, sentence).then();
        return taskId;
    }

    public async formatSplit(text: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.formatSplit(taskId, text).then();
        return taskId;
    }

    public async phraseGroup(sentence: string) {
        const taskId = await this.dpTaskService.create();
        this.aiService.phraseGroup(taskId, sentence).then();
        return taskId;
    }

    public async punctuation({ no, srt }: { no: number, srt: string }) {
        const taskId = await this.dpTaskService.create();
        this.aiService.punctuation(taskId, no, srt).then();
        return taskId;
    }

    public async translateWithContext({ sentence, context }: { sentence: string, context: string[] }) {
        const taskId = await this.dpTaskService.create();
        this.aiService.translateWithContext(taskId, sentence, context).then();
        return taskId;
    }

    public async tts(string: string) {
        return UrlUtil.dp(await TtsService.tts(string));
    }

    public async chat({ msgs }: { msgs: CoreMessage[] }): Promise<number> {
        const taskId = await this.dpTaskService.create();
        this.chatService.chat(taskId, msgs).then();
        return taskId;
    }

    public async transcript({ filePath }: { filePath: string }) {
        this.logger.info('Transcription task started', { filePath });

        // 发送初始任务状态到前端
        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId: 0,
                status: DpTaskState.INIT,
                result: { message: '初始化...' }
            }]
        });

        // 检查转录服务设置
        const transcriptionEngine = await this.settingService.getCurrentTranscriptionProvider();
        const modelSize = (await this.settingService.get('whisper.modelSize')) === 'large' ? 'large' : 'base';
        const modelTag = modelSize === 'large' ? 'large-v3' : 'base';
        const modelPath = path.join(LocationUtil.staticGetStoragePath('models'), 'whisper', `ggml-${modelTag}.bin`);
        const modelDownloaded = fs.existsSync(modelPath);

        let transcriptionService: TranscriptionService;
        let serviceName = '';

        if (transcriptionEngine === 'whisper' && modelDownloaded) {
            // 使用本地转录服务
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
                    result: { error: `本地 Whisper 模型未下载：${modelSize}。请到设置页面下载模型后再转录。` }
                }]
            });
            return;
        } else if (transcriptionEngine === 'openai') {
            // 使用云转录服务
            transcriptionService = this.cloudTranscriptionService;
            serviceName = 'Cloud';
            this.logger.info('Using cloud transcription service');
        } else {
            // 没有启用的转录服务
            this.logger.warn('No transcription service enabled');
            this.rendererGateway.fireAndForget('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId: 0,
                    status: DpTaskState.FAILED,
                    result: { error: '未启用任何转录服务' }
                }]
            });
            return;
        }

        // 开始转录
        transcriptionService.transcribe(filePath).catch(error => {
            this.logger.error(`${serviceName} transcription failed`, { error: error instanceof Error ? error.message : String(error) });
        });
    }

    // 取消转录任务
    public async cancelTranscription({ filePath }: { filePath: string }): Promise<boolean> {
        this.logger.info('Cancelling transcription task', { filePath });

        try {
            // 尝试取消本地转录
            const localSuccess = this.localTranscriptionService.cancel(filePath);
            if (localSuccess) {
                this.logger.info('Local transcription task cancelled successfully', { filePath });
                return true;
            }

            // 尝试取消云转录
            const cloudSuccess = this.cloudTranscriptionService.cancel(filePath);
            if (cloudSuccess) {
                this.logger.info('Cloud transcription task cancelled successfully', { filePath });
                return true;
            }

            // 返回 false 表示任务不存在（不在本地转录服务中，也不在云转录服务中）
            // 前端收到 false 后会更新任务状态为已取消
            this.logger.warn('Transcription task does not exist', { filePath });
            return false;
        } catch (error) {
            this.logger.error('Error cancelling transcription task', { filePath, error });
            return false;
        }
    }


    public async explainSelectWithContext({ sentence, selectedWord }: { sentence: string, selectedWord: string }) {
        const taskId = await this.dpTaskService.create();
        this.aiService.explainSelectWithContext(taskId, sentence, selectedWord).then();
        return taskId;
    }

    public async explainSelect({ word }: { word: string }) {
        const taskId = await this.dpTaskService.create();
        this.aiService.explainSelect(taskId, word).then();
        return taskId;
    }


    registerRoutes(): void {
        registerRoute('ai-func/analyze-new-words', (p) => this.analyzeNewWords(p));
        registerRoute('ai-func/analyze-new-phrases', (p) => this.analyzeNewPhrases(p));
        registerRoute('ai-func/analyze-grammars', (p) => this.analyzeGrammars(p));
        registerRoute('ai-func/make-example-sentences', (p) => this.makeSentences(p));
        registerRoute('ai-func/punctuation', (p) => this.punctuation(p));
        registerRoute('ai-func/polish', (p) => this.polish(p));
        registerRoute('ai-func/format-split', (p) => this.formatSplit(p));
        registerRoute('ai-func/phrase-group', (p) => this.phraseGroup(p));
        registerRoute('ai-func/tts', (p) => this.tts(p));
        registerRoute('ai-func/chat', (p) => this.chat(p));
        registerRoute('ai-func/transcript', (p) => this.transcript(p));
        registerRoute('ai-func/cancel-transcription', (p) => this.cancelTranscription(p));
        registerRoute('ai-func/explain-select-with-context', (p) => this.explainSelectWithContext(p));
        registerRoute('ai-func/explain-select', (p) => this.explainSelect(p));
        registerRoute('ai-func/translate-with-context', (p) => this.translateWithContext(p));
    }
}
