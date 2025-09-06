# DashPlayer Parakeet v2 本地字幕生成集成方案

## 核心目标
为 DashPlayer 添加基于 Parakeet v2 的本地字幕生成功能，作为 Whisper API 的离线补充方案。

## 关键技术点

### 1. 包依赖
```json
{
    "dependencies": {
        "sherpa-onnx-node": "^2.0.0"
    }
}
```

### 2. 环境变量设置 (必须)
在启动 Electron 进程前设置动态库路径：
- **macOS**: `DYLD_LIBRARY_PATH`
- **Linux**: `LD_LIBRARY_PATH` 
- **Windows**: 通常不需要设置

路径根据平台和包管理器(npm/pnpm)不同而变化。

### 3. 模型文件
- **下载地址**: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2`
- **存储位置**: `{userData}/models/parakeet-v2/`
- **必需文件**: `model.int8.onnx`, `tokens.txt`

### 4. 音频格式要求 (严格)
- **采样率**: 16kHz
- **声道**: 单声道  
- **格式**: 16-bit PCM WAV
- **FFmpeg 命令**: `ffmpeg -i input -ar 16000 -ac 1 -c:a pcm_s16le -f wav output.wav`

### 5. 核心识别代码
```typescript
const sherpa = require('sherpa-onnx-node');
const config = {
    model: {
        nemo_parakeet_tdt: {
            model: 'path/to/model.int8.onnx'
        },
        tokens: 'path/to/tokens.txt',
        numThreads: 2,
        debug: false,
    },
    featConfig: {
        sampleRate: 16000,
        featureDim: 80,
    },
    enableEndpoint: false,
};

const recognizer = new sherpa.OfflineRecognizer(config);
const wave = sherpa.readWave('audio.wav');
const stream = recognizer.createStream();
stream.acceptWaveform(wave.sampleRate, wave.samples);
recognizer.decode(stream);
const result = recognizer.getResult(stream);
```

### 6. 结果处理
- **优先级**: `segments` > `words` > `timestamps` > 整段文本
- **SRT 生成**: 需要将时间戳转换为标准 SRT 格式
- **智能合并**: 合并时间连续且文本较短的条目(40字符内，0.6秒间隔)

### 7. 设置集成
- **位置**: 扩展现有 `OpenAiSetting.tsx`
- **存储**: 使用现有的 `electron-store` 系统
- **配置项**: 
  - `parakeet.enabled`: 是否启用
  - `parakeet.modelDownloaded`: 模型是否已下载
  - `parakeet.modelPath`: 模型路径

### 8. 文件存储结构
```
{userData}/
├── models/
│   └── parakeet-v2/
│       ├── model.int8.onnx
│       └── tokens.txt
├── temp/whisper/          # 现有
└── videos/               # 现有
```

## 实现提醒

### ⚠️ 重要注意事项
1. **环境变量必须设置**，否则 sherpa-onnx-node 无法加载动态库
2. **音频格式必须正确**，否则识别结果会很差或失败
3. **模型文件路径要正确**，注意 tokens.txt 和 model.int8.onnx 的相对位置
4. **并发控制**：建议限制并发识别数量，避免内存问题
5. **错误处理**：网络下载、模型加载、音频处理都需要完善的错误处理

### 🔧 调试建议
1. 先用官方的 `test_asr_non_streaming_nemo_parakeet_tdt_v2.js` 测试环境是否正常
2. 验证音频格式是否正确
3. 检查模型文件完整性
4. 查看 sherpa-onnx 的 console 输出

### 📦 性能考虑
- 模型大小约 150MB，首次下载需要时间
- INT8 量化模型在 CPU 上性能较好
- 内存占用会持续存在，考虑提供释放机制
- 长音频建议分段处理

## 集成步骤
1. 在 `OpenAiSetting.tsx` 添加 Parakeet 配置界面
2. 实现 `ParakeetService` 核心服务
3. 扩展 `AiFuncController` 添加转录接口
4. 修改转录页面支持引擎选择
5. 测试完整流程

## 相关文件位置
- 设置页面: `src/fronted/pages/setting/OpenAiSetting.tsx`
- 设置存储: `src/backend/services/SettingService.ts`
- FFmpeg: `src/backend/services/impl/FfmpegServiceImpl.ts`
- 转录控制器: `src/backend/controllers/AiFuncController.ts`