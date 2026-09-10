import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import SpeechRecognitionGateway, { SpeechRecognitionRequest, SpeechRecognitionResult } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import TYPES from '@/backend/ioc/types';
import { WhisperCppCli } from '@/backend/infrastructure/media/whispercpp/WhisperCppCli';
import { WHISPER_CPP_MODEL_DIRECTORY, WHISPER_CPP_REQUIRED_FILES } from '@/backend/services/models/whisperCppModel';

/**
 * whisper.cpp 识别线程数。
 *
 * 实测（Intel Ultra 5 228V）：核显模式下线程数几乎不影响耗时（瓶颈在 GPU），
 * CPU 模式下 4 线程最优，故固定为 4。
 */
const WHISPER_CPP_NUM_THREADS = 4;

/**
 * 基于 whisper.cpp parakeet-cli 与 Parakeet v3 GGUF 的本地识别网关。
 *
 * 相比 sherpa-onnx CPU 方案：核显（Vulkan/Metal）加速后 RTF 约 0.02，
 * 为 sherpa-onnx CPU 的 1/4 左右，且进程内存显著更低。
 */
@injectable()
export default class WhisperCppGatewayImpl implements SpeechRecognitionGateway {
    constructor(@inject(TYPES.WhisperCppCli) private readonly cli: WhisperCppCli) {}

    /**
     * 使用 Parakeet v3 GGUF（q8_0）模型识别音频。
     * @param request 音频路径、模型目录与生命周期回调。
     * @returns 完整文本及子词开始时间轴。
     */
    public async transcribe(request: SpeechRecognitionRequest): Promise<SpeechRecognitionResult> {
        const modelDir = path.join(request.modelsRoot, WHISPER_CPP_MODEL_DIRECTORY);
        for (const fileName of WHISPER_CPP_REQUIRED_FILES) {
            const filePath = path.join(modelDir, fileName);
            if (!fs.existsSync(filePath)) {
                throw new Error(`whisper.cpp 模型文件缺失：${filePath}，请先在设置中心下载模型`);
            }
        }
        const modelPath = path.join(modelDir, WHISPER_CPP_REQUIRED_FILES[0]);

        const output = await this.cli.run({
            modelPath,
            audioPath: request.audioPath,
            numThreads: WHISPER_CPP_NUM_THREADS,
            job: request.job,
            isCancelled: request.isCancelled,
            onHeartbeat: request.onHeartbeat,
        });
        return {
            text: output.text,
            tokens: output.tokens,
        };
    }

    /** 终止当前 whisper.cpp 识别进程。 */
    public cancelActive(): void {
        this.cli.killActive();
    }
}
