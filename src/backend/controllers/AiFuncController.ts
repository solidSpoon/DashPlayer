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

@injectable()
export default class AiFuncController implements Controller {

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
        console.log('taskId', taskId);

        // 检查转录服务设置
        const whisperEnabled = await this.settingService.get('whisper.enabled') === 'true';
        const whisperTranscriptionEnabled = await this.settingService.get('whisper.enableTranscription') === 'true';
        const openaiTranscriptionEnabled = await this.settingService.get('services.openai.enableTranscription') === 'true';
        const modelDownloaded = await this.systemService.isParakeetModelDownloaded();

        if (whisperEnabled && whisperTranscriptionEnabled && modelDownloaded) {
            // 使用 Whisper 进行转录（优先本地）
            console.log('Using Whisper for transcription');
            this.parakeetService.transcribeAudio(taskId, filePath).then(r => {
                console.log('whisper transcript result:', r);
                console.log('transcript result structure:', {
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
                    console.log('Building SRT content from', r.segments.length, 'segments');
                    const srtContent = this.buildSrtContent(r.segments);
                    const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
                    
                    console.log('Attempting to save SRT file to:', srtFileName);
                    try {
                        fs.writeFileSync(srtFileName, srtContent, 'utf8');
                        console.log('✅ SRT file saved successfully:', srtFileName);
                        console.log('SRT content preview:', srtContent.substring(0, 500) + '...');
                        
                        // 更新任务状态 - 将结果序列化为 JSON 字符串
                        const resultJson = JSON.stringify({ srtPath: srtFileName, segments: r.segments });
                        this.dpTaskService.process(taskId, { 
                            progress: `转录完成，字幕文件已保存: ${path.basename(srtFileName)}`,
                            result: resultJson
                        });
                    } catch (saveError) {
                        console.error('❌ Failed to save SRT file:', saveError);
                        // 将结果序列化为 JSON 字符串
                      const resultJson = JSON.stringify({ segments: r.segments });
                      this.dpTaskService.process(taskId, { 
                            progress: `转录完成但保存字幕文件失败: ${saveError.message}`,
                            result: resultJson
                        });
                    }
                } else {
                    console.log('❌ No segments found in transcription result');
                    console.log('Available keys:', Object.keys(r || {}));
                    // 将结果序列化为 JSON 字符串
                    const resultJson = JSON.stringify(r);
                    this.dpTaskService.process(taskId, { 
                        progress: '转录完成但没有生成有效的时间轴数据',
                        result: resultJson
                    });
                }
            }).catch(error => {
                console.error('Parakeet transcription failed:', error);
                this.dpTaskService.process(taskId, { 
                    progress: `转录失败: ${error.message}`,
                    status: 'failed' 
                });
            });
        } else if (openaiTranscriptionEnabled) {
            // 使用 OpenAI Whisper 进行转录
            console.log('Using OpenAI Whisper for transcription');
            this.whisperService.transcript(taskId, filePath).then(r => {
                console.log('whisper transcript result:', r);
            });
        } else {
            // 没有启用的转录服务
            console.log('No transcription service enabled');
            this.dpTaskService.process(taskId, { 
                progress: '错误：未启用任何转录服务',
                status: 'failed' 
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

