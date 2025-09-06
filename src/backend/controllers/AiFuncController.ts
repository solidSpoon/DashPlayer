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
import {ParakeetService} from '@/backend/services/ParakeetService';
import SystemService from '@/backend/services/SystemService';
import { CoreMessage } from 'ai';
import SettingService from "@/backend/services/SettingService";
import fs from 'fs';
import path from 'path';
import { getMainLogger } from '@/backend/ioc/simple-logger';

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

    @inject(TYPES.ParakeetService)
    private parakeetService!: ParakeetService;

    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    @inject(TYPES.SettingService)
    private settingService!: SettingService;

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
        const taskId = await this.dpTaskService.create();
        this.logger.info('Transcription task started', { taskId });

        // 发送初始任务状态到前端
        this.systemService.callRendererApi('transcript/batch-result', {
            updates: [{
                filePath,
                taskId,
                status: 'init',
                progress: 0
            }]
        });

        // 检查转录服务设置
        const whisperEnabled = await this.settingService.get('whisper.enabled') === 'true';
        const whisperTranscriptionEnabled = await this.settingService.get('whisper.enableTranscription') === 'true';
        const openaiTranscriptionEnabled = await this.settingService.get('services.openai.enableTranscription') === 'true';
        const modelDownloaded = await this.systemService.isParakeetModelDownloaded();

        if (whisperEnabled && whisperTranscriptionEnabled && modelDownloaded) {
            // 使用 Whisper 进行转录（优先本地）
            this.logger.info('Using Whisper for transcription');
            
            // 发送开始转录状态
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId,
                    status: 'processing',
                    progress: 10
                }]
            });

            this.parakeetService.transcribeAudio(taskId, filePath).then(r => {
                this.logger.debug('Whisper transcript result', { result: r });
                this.logger.debug('Transcript result structure', {
                    hasText: !!r?.text,
                    hasSegments: !!r?.segments,
                    hasWords: !!r?.words,
                    hasTimestamps: !!r?.timestamps,
                    textLength: r?.text?.length,
                    segmentsLength: r?.segments?.length,
                    wordsLength: r?.words?.length,
                    timestampsLength: r?.timestamps?.length
                });
                
                // 生成 SRT 文件
                if (r && r.segments && r.segments.length > 0) {
                    this.logger.info('Building SRT content', { segments: r.segments.length });
                    const srtContent = this.buildSrtContent(r.segments);
                    const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
                    
                    this.logger.info('Saving SRT file', { fileName: srtFileName });
                    try {
                        fs.writeFileSync(srtFileName, srtContent, 'utf8');
                        this.logger.info('SRT file saved successfully', { fileName: srtFileName });
                        this.logger.debug('SRT content preview', { preview: srtContent.substring(0, 500) + '...' });
                        
                        // 发送完成状态到前端
                        this.systemService.callRendererApi('transcript/batch-result', {
                            updates: [{
                                filePath,
                                taskId,
                                status: 'completed',
                                progress: 100,
                                result: { srtPath: srtFileName, segments: r.segments }
                            }]
                        });

                        // 更新任务状态 - 将结果序列化为 JSON 字符串
                        const resultJson = JSON.stringify({ srtPath: srtFileName, segments: r.segments });
                    } catch (saveError) {
                        this.logger.error('Failed to save SRT file', { error: saveError instanceof Error ? saveError.message : String(saveError) });
                        
                        // 发送错误状态到前端
                        this.systemService.callRendererApi('transcript/batch-result', {
                            updates: [{
                                filePath,
                                taskId,
                                status: 'error',
                                progress: 0,
                                result: { error: saveError.message }
                            }]
                        });

                                            }
                } else {
                    this.logger.warn('No segments found in transcription result');
                    this.logger.debug('Available keys in result', { keys: Object.keys(r || {}) });
                    
                    // 发送无结果状态到前端
                    this.systemService.callRendererApi('transcript/batch-result', {
                        updates: [{
                            filePath,
                            taskId,
                            status: 'no_segments',
                            progress: 100,
                            result: r
                        }]
                    });

                                    }
            }).catch(error => {
                this.logger.error('Parakeet transcription failed', { error: error instanceof Error ? error.message : String(error) });
                
                // 发送失败状态到前端
                this.systemService.callRendererApi('transcript/batch-result', {
                    updates: [{
                        filePath,
                        taskId,
                        status: 'failed',
                        progress: 0,
                        result: { error: error.message }
                    }]
                });

                            });
        } else if (openaiTranscriptionEnabled) {
            // 使用 OpenAI Whisper 进行转录
            this.logger.info('Using OpenAI Whisper for transcription');
            
            // 发送开始转录状态
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId,
                    status: 'processing',
                    progress: 10
                }]
            });

            this.whisperService.transcript(taskId, filePath).then(r => {
                this.logger.debug('Whisper transcript result', { result: r });
                
                // 发送完成状态到前端
                this.systemService.callRendererApi('transcript/batch-result', {
                    updates: [{
                        filePath,
                        taskId,
                        status: 'completed',
                        progress: 100,
                        result: r
                    }]
                });
            }).catch(error => {
                this.logger.error('OpenAI Whisper transcription failed', { error: error instanceof Error ? error.message : String(error) });
                
                // 发送失败状态到前端
                this.systemService.callRendererApi('transcript/batch-result', {
                    updates: [{
                        filePath,
                        taskId,
                        status: 'failed',
                        progress: 0,
                        result: { error: error.message }
                    }]
                });
            });
        } else {
            // 没有启用的转录服务
            this.logger.warn('No transcription service enabled');
            
            // 发送错误状态到前端
            this.systemService.callRendererApi('transcript/batch-result', {
                updates: [{
                    filePath,
                    taskId,
                    status: 'no_service',
                    progress: 0,
                    result: { error: '未启用任何转录服务' }
                }]
            });

                    }
        return taskId;
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

    private buildSrtContent(items: Array<{start: number, end: number, text: string}>): string {
        let srt = '';
        items.forEach((item, index) => {
            srt += `${index + 1}\n`;
            srt += `${this.toSrtTime(item.start)} --> ${this.toSrtTime(item.end)}\n`;
            srt += `${item.text}\n\n`;
        });
        return srt;
    }

    private toSrtTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        const pad = (n: number, width: number) => String(n).padStart(width, '0');
        return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
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
        registerRoute('ai-func/explain-select-with-context', (p) => this.explainSelectWithContext(p));
        registerRoute('ai-func/explain-select', (p) => this.explainSelect(p));
        registerRoute('ai-func/translate-with-context', (p) => this.translateWithContext(p));
    }
}

