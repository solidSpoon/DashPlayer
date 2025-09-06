# DashPlayer Parakeet v2 本地字幕生成集成方案

## 1. 概述

### 1.1 目标
为 DashPlayer 添加基于 Parakeet v2 的本地字幕生成功能，提供离线、私密的语音识别能力，作为现有 Whisper API 的补充方案。

### 1.2 技术选型
- **ASR 模型**: K2-FSA Sherpa-ONNX Parakeet v2 (nvidia/parakeet-tdt-0.6b-v2)
- **Node.js 包**: sherpa-onnx-node
- **模型格式**: ONNX INT8 量化版本
- **运行环境**: Node.js (Electron Main Process)
- **音频处理**: FFmpeg (现有)
- **字幕格式**: SRT (现有)
- **环境配置**: 动态库路径设置

### 1.3 核心优势
- **完全离线**: 无需网络连接
- **隐私保护**: 音频数据本地处理
- **高性价比**: 免费使用，无 API 成本
- **快速响应**: 本地处理，低延迟
- **集成简单**: 基于 Node.js，易于集成

## 2. 现有架构分析

### 2.1 当前字幕生成流程
```
视频文件 → FFmpeg 分割 → Whisper API → 结果整合 → SRT 文件
```

### 2.2 现有组件架构
- **WhisperService**: Whisper API 调用服务
- **AiFuncController**: AI 功能控制器
- **SrtUtil**: SRT 格式处理工具
- **FFmpeg**: 音频处理
- **Task 管理**: 任务状态跟踪

### 2.3 存储结构
```
用户文档目录/DashPlayer/
├── temp/whisper/{hash}/     # 临时音频文件
├── videos/                 # 视频和字幕文件
└── data/                   # 数据库
```

## 3. Parakeet v2 集成方案

### 3.1 整体架构设计

#### 3.1.1 双引擎字幕生成系统
```
视频文件 → FFmpeg 分割 → [Whisper API | Parakeet v2] → 结果整合 → SRT 文件
```

#### 3.1.2 新增组件结构
```
src/
├── backend/
│   ├── services/
│   │   ├── ParakeetService.ts           # Parakeet 服务接口
│   │   └── impl/
│   │       └── ParakeetServiceImpl.ts   # Parakeet 服务实现
│   ├── controllers/
│   │   └── AiFuncController.ts          # 扩展现有控制器
│   └── utils/
│       ├── ParakeetDownloader.ts        # 模型下载管理
│       └── ParakeetEnvSetup.ts          # 环境变量设置
├── common/
│   ├── types/
│   │   └── ParakeetTypes.ts            # Parakeet 相关类型
│   └── utils/
│       └── ParakeetUtil.ts             # Parakeet 工具函数
└── fronted/
    └── pages/
        └── setting/
            └── OpenAiSetting.tsx         # 扩展 OpenAI 设置页面
```

### 3.1.3 存储目录结构
```
用户文档目录/DashPlayer[-dev]/          # 基础存储路径
├── models/                             # 模型文件目录
│   └── parakeet-v2/                    # Parakeet v2 模型
│       ├── model.int8.onnx             # ONNX 模型文件
│       └── tokens.txt                  # 词表文件
├── temp/whisper/{hash}/                # Whisper 临时文件目录
├── videos/                             # 视频文件存储
└── data/                               # 数据库文件
```

### 3.2 核心服务设计

#### 3.2.1 ParakeetService 接口
```typescript
interface ParakeetService {
    /**
     * 设置环境变量并初始化 Parakeet 模型
     */
    initialize(): Promise<void>;
    
    /**
     * 检查模型是否已下载
     */
    isModelDownloaded(): Promise<boolean>;
    
    /**
     * 下载 Parakeet 模型
     */
    downloadModel(progressCallback: (progress: number) => void): Promise<void>;
    
    /**
     * 转录音频文件 (16kHz 单声道 WAV)
     */
    transcribeAudio(audioPath: string): Promise<TranscriptionResult>;
    
    /**
     * 批量转录音频文件
     */
    transcribeBatch(audioPaths: string[]): Promise<TranscriptionResult[]>;
    
    /**
     * 释放模型资源
     */
    dispose(): void;
}
```

#### 3.2.2 环境变量设置
```typescript
class ParakeetEnvSetup {
    static setupEnvironment(): void {
        const platform = os.platform();
        const arch = os.arch();
        const isPnpm = this.isPnpmEnvironment();
        
        let libraryPath;
        if (platform === 'darwin') {
            if (arch === 'x64') {
                libraryPath = isPnpm 
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-darwin-x64'
                    : 'node_modules/sherpa-onnx-darwin-x64';
            } else if (arch === 'arm64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-darwin-arm64'
                    : 'node_modules/sherpa-onnx-darwin-arm64';
            }
        } else if (platform === 'linux') {
            if (arch === 'x64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-linux-x64'
                    : 'node_modules/sherpa-onnx-linux-x64';
            } else if (arch === 'arm64') {
                libraryPath = isPnpm
                    ? 'node_modules/.pnpm/sherpa-onnx-node@*/node_modules/sherpa-onnx-linux-arm64'
                    : 'node_modules/sherpa-onnx-linux-arm64';
            }
        }
        
        if (libraryPath) {
            const envVar = platform === 'darwin' ? 'DYLD_LIBRARY_PATH' : 'LD_LIBRARY_PATH';
            process.env[envVar] = `${path.resolve(process.cwd(), libraryPath)}:${process.env[envVar] || ''}`;
        }
    }
    
    private static isPnpmEnvironment(): boolean {
        return fs.existsSync(path.join(process.cwd(), 'node_modules', '.pnpm'));
    }
}
```

#### 3.2.3 转录结果类型
```typescript
interface TranscriptionResult {
    // 根据 sherpa-onnx 实际返回结构调整
    text?: string;          // 完整文本
    segments?: Array<{      // 分段结果 (优先)
        start: number;      // 开始时间 (秒)
        end: number;        // 结束时间 (秒)
        text: string;       // 识别文本
    }>;
    words?: Array<{         // 词语级别结果 (备选)
        word: string;       // 词语
        start: number;      // 开始时间 (秒)
        end: number;        // 结束时间 (秒)
    }>;
    timestamps?: Array<{     // 时间戳结果 (备选)
        token: string;      // 标记
        start: number;      // 开始时间 (秒)
        end: number;        // 结束时间 (秒)
    }>;
}
```

#### 3.2.4 SRT 生成工具
```typescript
class ParakeetSrtGenerator {
    static generateSrt(result: TranscriptionResult, audioDuration: number): string {
        let items = [];
        
        // 优先使用 segments，其次 words，最后 timestamps
        if (Array.isArray(result.segments) && result.segments.length > 0) {
            items = result.segments.map(s => ({ 
                text: s.text, 
                start: s.start, 
                end: s.end 
            }));
        } else if (Array.isArray(result.words) && result.words.length > 0) {
            items = result.words.map(w => ({ 
                text: w.word, 
                start: w.start, 
                end: w.end 
            }));
        } else if (Array.isArray(result.timestamps) && result.timestamps.length > 0) {
            items = result.timestamps.map(t => ({ 
                text: t.token, 
                start: t.start, 
                end: t.end 
            }));
        } else {
            // 兜底：整段文本
            const text = result.text || '';
            const end = Number.isFinite(audioDuration) ? audioDuration : Math.max(1, text.length * 0.3);
            items = [{ text, start: 0, end }];
        }
        
        // 智能合并：合并时间连续且文本较短的条目
        const merged = this.mergeItems(items, {
            maxChars: 40,      // 每行最大字符数
            maxGap: 0.6         // 最大时间间隔 (秒)
        });
        
        // 生成 SRT 格式
        return this.buildSrtContent(merged);
    }
    
    private static mergeItems(items: any[], options: { maxChars: number; maxGap: number }): any[] {
        const merged = [];
        for (const item of items) {
            const last = merged[merged.length - 1];
            if (last &&
                item.start - last.end <= options.maxGap &&
                (last.text + ' ' + item.text).length <= options.maxChars) {
                last.text = `${last.text} ${item.text}`.trim();
                last.end = Math.max(last.end, item.end);
            } else {
                merged.push({ ...item });
            }
        }
        return merged;
    }
    
    private static buildSrtContent(items: any[]): string {
        let srt = '';
        items.forEach((item, index) => {
            srt += `${index + 1}\n`;
            srt += `${this.toSrtTime(item.start)} --> ${this.toSrtTime(item.end)}\n`;
            srt += `${item.text}\n\n`;
        });
        return srt;
    }
    
    private static toSrtTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        const pad = (n: number, width: number) => String(n).padStart(width, '0');
        return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
    }
}
```

### 3.3 数据库设计扩展

#### 3.3.1 Parakeet 配置表
```sql
CREATE TABLE dp_parakeet_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_dir TEXT NOT NULL,            -- 模型目录路径
    model_file TEXT NOT NULL,           -- 模型文件名 (model.int8.onnx)
    tokens_file TEXT NOT NULL,          -- 词表文件名 (tokens.txt)
    is_downloaded BOOLEAN DEFAULT 0,    -- 是否已下载
    download_progress REAL DEFAULT 0,   -- 下载进度 (0-1)
    version TEXT DEFAULT 'v2',          -- 模型版本
    enable BOOLEAN DEFAULT 1,          -- 是否启用
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.3.2 转录任务扩展
```sql
-- 扩展现有的 dp_task 表
ALTER TABLE dp_task ADD COLUMN engine_type TEXT DEFAULT 'whisper'; -- 'whisper' | 'parakeet'
```

### 3.4 API 接口扩展

#### 3.4.1 扩展 AiFuncController
```typescript
// 在现有的 ai-func API 定义中添加
interface AiFuncDef {
    // 现有 API...
    'ai-func/transcript-parakeet': { 
        params: { filePath: string }, 
        return: number 
    };
    'ai-func/parakeet-model-status': { 
        params: void, 
        return: { downloaded: boolean; progress: number; size?: number } 
    };
    'ai-func/download-parakeet-model': { 
        params: void, 
        return: number 
    };
}
```

## 4. 实现细节

### 4.1 模型管理

#### 4.1.1 模型下载策略
```typescript
class ParakeetDownloader {
    private readonly MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2';
    private readonly MODEL_SIZE = 150 * 1024 * 1024; // 约 150MB
    private readonly TARGET_DIR = path.join(app.getPath('userData'), 'models', 'parakeet-v2');
    
    async downloadModel(progressCallback: (progress: number) => void): Promise<void> {
        // 1. 创建目标目录
        await fs.promises.mkdir(this.TARGET_DIR, { recursive: true });
        
        // 2. 下载压缩包
        const tempPath = path.join(this.TARGET_DIR, 'download.tar.bz2');
        await this.downloadFile(this.MODEL_URL, tempPath, progressCallback);
        
        // 3. 解压文件
        await this.extractArchive(tempPath, this.TARGET_DIR);
        
        // 4. 验证文件完整性
        await this.validateModelFiles(this.TARGET_DIR);
        
        // 5. 清理临时文件
        await fs.promises.unlink(tempPath);
        
        // 6. 更新数据库
        await this.updateDatabaseConfig(this.TARGET_DIR);
    }
    
    private async downloadFile(url: string, path: string, progressCallback: (progress: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const fs = require('fs');
            const file = fs.createWriteStream(path);
            
            https.get(url, (response: any) => {
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    const progress = totalSize > 0 ? downloadedSize / totalSize : 0;
                    progressCallback(progress);
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
                
                file.on('error', (err: any) => {
                    fs.unlink(path, () => {});
                    reject(err);
                });
            }).on('error', reject);
        });
    }
    
    private async extractArchive(archivePath: string, targetDir: string): Promise<void> {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        await execAsync(`tar -xjf "${archivePath}" -C "${targetDir}"`);
    }
    
    private async validateModelFiles(modelDir: string): Promise<void> {
        const modelFile = path.join(modelDir, 'model.int8.onnx');
        const tokensFile = path.join(modelDir, 'tokens.txt');
        
        if (!await fs.promises.access(modelFile).catch(() => false)) {
            throw new Error('Model file not found: model.int8.onnx');
        }
        
        if (!await fs.promises.access(tokensFile).catch(() => false)) {
            throw new Error('Tokens file not found: tokens.txt');
        }
    }
    
    private async updateDatabaseConfig(modelDir: string): Promise<void> {
        // 更新数据库配置
        const sql = `
            INSERT OR REPLACE INTO dp_parakeet_config 
            (id, model_dir, model_file, tokens_file, is_downloaded, download_progress, version, enable)
            VALUES (1, ?, ?, ?, 1, 1.0, 'v2', 1)
        `;
        
        await db.execute(sql, [
            modelDir,
            'model.int8.onnx',
            'tokens.txt'
        ]);
    }
}
```

#### 4.1.2 模型版本管理
- 支持多版本并存
- 自动清理旧版本
- 版本兼容性检查

### 4.2 音频处理优化

#### 4.2.1 音频预处理 (必须)
```typescript
// Parakeet v2 要求的音频格式：16kHz、单声道、16-bit PCM WAV
const parakeetAudioConfig = {
    sampleRate: 16000,
    channels: 1,
    format: 'wav',
    codec: 'pcm_s16le'  // 16-bit PCM
};

// 扩展现有的 FfmpegCommands
class FfmpegCommands {
    static buildParakeetAudio(inputFile: string, outputFile: string): any {
        return ffmpeg(inputFile)
            .outputOptions([
                '-vn',                    // 禁用视频
                '-ar', '16000',           // 采样率 16kHz
                '-ac', '1',               // 单声道
                '-c:a', 'pcm_s16le',      // 16-bit PCM
                '-f', 'wav'               // WAV 格式
            ])
            .output(outputFile);
    }
}
```

#### 4.2.2 分片策略优化
- **智能分片**: 根据视频时长动态调整分片大小
- **重叠处理**: 分片间重叠 1-2 秒提高准确性
- **边界优化**: 分片边界智能对齐

### 4.3 并发处理优化

#### 4.3.1 资源管理
```typescript
class ParakeetResourceManager {
    private readonly MAX_CONCURRENT = 2; // 限制并发数
    private readonly queue: QueueItem[] = [];
    private activeCount = 0;
    
    async processAudio(audioPath: string): Promise<TranscriptionResult> {
        // 实现资源队列管理
    }
}
```

#### 4.3.2 内存管理
- 模型懒加载
- 资源自动释放
- 内存使用监控

### 4.4 错误处理和重试

#### 4.4.1 错误分类处理
```typescript
enum ParakeetErrorType {
    MODEL_NOT_LOADED = 'MODEL_NOT_LOADED',
    AUDIO_FORMAT_ERROR = 'AUDIO_FORMAT_ERROR',
    TRANSCRIPTION_ERROR = 'TRANSCRIPTION_ERROR',
    RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}
```

#### 4.4.2 智能重试机制
- 指数退避重试
- 错误类型区分处理
- 自动降级策略

## 5. 用户界面设计

### 5.1 设置界面扩展 (集成到 OpenAI 设置)

#### 5.1.1 扩展 OpenAI 设置页面
```typescript
// 在 OpenAiSetting.tsx 中添加 Parakeet 配置
const OpenAiSetting = () => {
    const [parakeetEnabled, setParakeetEnabled] = useState(false);
    const [modelStatus, setModelStatus] = useState({
        downloaded: false,
        progress: 0,
        size: 0
    });
    
    return (
        <div className="space-y-6">
            {/* 现有的 OpenAI 配置 */}
            <SettingSection title="OpenAI API 配置">
                {/* ... 现有配置 ... */}
            </SettingSection>
            
            {/* 新增 Parakeet 本地字幕生成配置 */}
            <SettingSection title="本地字幕生成 (Parakeet v2)">
                <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="parakeet-enabled"
                            checked={parakeetEnabled}
                            onCheckedChange={setParakeetEnabled}
                        />
                        <Label htmlFor="parakeet-enabled">
                            启用本地字幕生成
                        </Label>
                    </div>
                    
                    {parakeetEnabled && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">模型状态</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!modelStatus.downloaded ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">
                                                模型未下载 (约 150MB)
                                            </span>
                                            <Badge variant="secondary">需要下载</Badge>
                                        </div>
                                        <Button 
                                            onClick={downloadModel}
                                            disabled={downloading}
                                            className="w-full"
                                        >
                                            {downloading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    下载中... {Math.round(modelStatus.progress * 100)}%
                                                </>
                                            ) : (
                                                '下载模型'
                                            )}
                                        </Button>
                                        {downloading && (
                                            <Progress value={modelStatus.progress * 100} />
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">模型已就绪</span>
                                        </div>
                                        <Badge variant="default">已启用</Badge>
                                    </div>
                                )}
                                
                                <div className="text-xs text-muted-foreground">
                                    <p>• 支持离线字幕生成，无需网络连接</p>
                                    <p>• 模型存储在本地，保护隐私</p>
                                    <p>• 仅支持英文语音识别</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </SettingSection>
        </div>
    );
};
```

#### 5.1.2 核心实现代码
```typescript
// ParakeetServiceImpl.ts 核心实现
@Injectable()
export class ParakeetServiceImpl implements ParakeetService {
    private recognizer: any = null;
    private initialized = false;
    
    constructor(
        @inject('SettingService') private settingService: SettingService,
        @inject('DpTaskService') private taskService: DpTaskService
    ) {}
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        // 1. 设置环境变量
        ParakeetEnvSetup.setupEnvironment();
        
        // 2. 检查模型是否已下载
        const config = await this.getModelConfig();
        if (!config?.is_downloaded) {
            throw new Error('Parakeet model not downloaded');
        }
        
        // 3. 加载 sherpa-onnx-node
        const sherpa = require('sherpa-onnx-node');
        
        // 4. 创建识别器配置 (按照官方示例)
        const recognizerConfig = {
            model: {
                nemo_parakeet_tdt: {
                    model: path.join(config.model_dir, config.model_file)
                },
                tokens: path.join(config.model_dir, config.tokens_file),
                numThreads: 2,
                debug: false,
            },
            featConfig: {
                sampleRate: 16000,
                featureDim: 80,
            },
            enableEndpoint: false,
        };
        
        // 5. 创建识别器
        this.recognizer = new sherpa.OfflineRecognizer(recognizerConfig);
        this.initialized = true;
    }
    
    async transcribeAudio(audioPath: string): Promise<TranscriptionResult> {
        if (!this.initialized) {
            await this.initialize();
        }
        
        // 1. 读取 WAV 文件
        const sherpa = require('sherpa-onnx-node');
        const wave = sherpa.readWave(audioPath);
        
        // 2. 创建流并输入音频
        const stream = this.recognizer.createStream();
        stream.acceptWaveform(wave.sampleRate, wave.samples);
        
        // 3. 执行识别
        this.recognizer.decode(stream);
        const result = this.recognizer.getResult(stream);
        
        // 4. 返回结构化结果
        return {
            text: result.text,
            segments: result.segments,
            words: result.words,
            timestamps: result.timestamps
        };
    }
    
    async generateSrt(audioPath: string, outputPath: string): Promise<void> {
        // 1. 转录音频
        const result = await this.transcribeAudio(audioPath);
        
        // 2. 获取音频时长
        const sherpa = require('sherpa-onnx-node');
        const wave = sherpa.readWave(audioPath);
        const duration = wave.samples.length / wave.sampleRate;
        
        // 3. 生成 SRT
        const srtContent = ParakeetSrtGenerator.generateSrt(result, duration);
        
        // 4. 保存文件
        await fs.promises.writeFile(outputPath, srtContent, 'utf8');
    }
    
    // ... 其他方法实现
}
```

### 5.2 转录界面优化

#### 5.2.1 引擎选择器
```typescript
// 在文件列表中添加引擎选择
const FileTranscriptItem = ({ file }) => {
    const [engine, setEngine] = useState<'whisper' | 'parakeet'>('whisper');
    
    return (
        <div className="flex items-center space-x-2">
            <Select value={engine} onValueChange={setEngine}>
                <SelectTrigger className="w-32">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="whisper">Whisper</SelectItem>
                    <SelectItem value="parakeet">Parakeet</SelectItem>
                </SelectContent>
            </Select>
            {/* 其他文件信息 */}
        </div>
    );
};
```

#### 5.2.2 性能指标显示
- 转录速度对比
- 准确率统计
- 资源使用监控

## 6. 性能优化策略

### 6.1 模型优化

#### 6.1.1 启动优化
```typescript
class ParakeetService {
    private modelInstance: any = null;
    private initializePromise: Promise<void> | null = null;
    
    async initialize(): Promise<void> {
        if (this.initializePromise) {
            return this.initializePromise;
        }
        
        this.initializePromise = this.doInitialize();
        return this.initializePromise;
    }
    
    private async doInitialize(): Promise<void> {
        // 模型加载实现
    }
}
```

#### 6.1.2 缓存策略
- **模型缓存**: 内存中保持模型实例
- **结果缓存**: 缓存转录结果
- **音频缓存**: 缓存预处理后的音频

### 6.2 并发优化

#### 6.2.1 任务队列
```typescript
class TranscriptionQueue {
    private readonly maxConcurrent = navigator.hardwareConcurrency || 4;
    private activeTasks = 0;
    private queue: Task[] = [];
    
    async enqueue(task: Task): Promise<Result> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }
}
```

#### 6.2.2 资源限制
- CPU 使用率限制
- 内存使用监控
- 磁盘 I/O 优化

## 7. 质量保证

### 7.1 准确性优化

#### 7.1.1 后处理算法
```typescript
class ParakeetPostProcessor {
    processSegments(segments: TranscriptionSegment[]): ProcessedSegment[] {
        // 实现后处理优化
        // 1. 时间边界优化
        // 2. 标点符号修复
        // 3. 文本规范化
        // 4. 重复内容过滤
    }
}
```

#### 7.1.2 质量评估
- 置信度评分
- 段落连贯性检查
- 异常结果过滤

### 7.2 性能监控

#### 7.2.1 性能指标
```typescript
interface PerformanceMetrics {
    transcriptionTime: number;    // 转录耗时
    audioProcessingTime: number;  // 音频处理耗时
    memoryUsage: number;          // 内存使用
    cpuUsage: number;            // CPU 使用率
    accuracy?: number;           // 准确率 (可选)
}
```

#### 7.2.2 监控实现
- 实时性能监控
- 错误日志记录
- 用户反馈收集

## 8. 部署和发布

### 8.1 依赖管理

#### 8.1.1 包依赖
```json
{
    "dependencies": {
        "sherpa-onnx-node": "^2.0.0",
        "fluent-ffmpeg": "^1.8.0",
        "ffmpeg-static": "^5.2.0"
    }
}
```

#### 8.1.2 模型分发
- 首次启动自动下载
- 增量更新支持
- CDN 加速下载

### 8.2 兼容性考虑

#### 8.2.1 系统要求
- **操作系统**: Windows 10+, macOS 10.15+, Linux
- **内存**: 最少 4GB，推荐 8GB+
- **存储**: 200MB 可用空间
- **CPU**: 支持 AVX2 指令集

#### 8.2.2 降级策略
- 模型加载失败时自动降级到 Whisper
- 内存不足时提示用户
- 网络错误时重试机制

## 9. 测试计划

### 9.1 单元测试
```typescript
describe('ParakeetService', () => {
    it('should initialize model correctly', async () => {
        // 测试模型初始化
    });
    
    it('should transcribe audio accurately', async () => {
        // 测试转录准确性
    });
    
    it('should handle errors gracefully', async () => {
        // 测试错误处理
    });
});
```

### 9.2 集成测试
- 端到端转录流程测试
- 用户界面交互测试
- 性能压力测试

### 9.3 用户验收测试
- 真实场景测试
- 用户体验评估
- 性能对比测试

## 10. 上线计划

### 10.1 阶段性发布
1. **第一阶段**: 基础功能实现 (2 周)
2. **第二阶段**: 性能优化和 UI 完善 (1 周)
3. **第三阶段**: 测试和 Bug 修复 (1 周)
4. **第四阶段**: 正式发布 (1 周)

### 10.2 风险控制
- 功能开关控制
- 灰度发布策略
- 快速回滚机制

## 11. 总结

### 11.1 预期收益
- **用户体验**: 离线转录，隐私保护
- **成本节约**: 减少 API 调用成本
- **技术提升**: 本地 AI 能力建设
- **产品差异化**: 竞争优势增强

### 11.2 技术挑战
- 模型集成复杂性
- 性能优化要求
- 用户体验平衡
- 兼容性维护

### 11.3 后续规划
- 多语言支持扩展
- 更多本地模型集成
- 云端协作优化
- 准确率持续提升

---

*本方案基于 DashPlayer 现有架构设计，充分考虑了兼容性、性能和用户体验。实现过程将采用渐进式集成方式，确保系统稳定性和用户满意度。*