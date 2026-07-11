import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import SpeechRecognitionGateway, { SpeechRecognitionRequest, SpeechRecognitionResult } from '@/backend/application/ports/gateways/media/SpeechRecognitionGateway';
import TYPES from '@/backend/ioc/types';
import { SherpaOnnxCli } from '@/backend/infrastructure/media/sherpa/SherpaOnnxCli';
import { PARAKEET_MODEL_DIRECTORY } from '@/backend/application/contracts/parakeetModel';

/**
 * 基于 sherpa-onnx CLI 与 Parakeet v3 的本地英语识别网关。
 */
@injectable()
export default class SherpaOnnxGatewayImpl implements SpeechRecognitionGateway {
    constructor(@inject(TYPES.SherpaOnnxCli) private readonly cli: SherpaOnnxCli) {}

    /**
     * 使用固定的 Parakeet v3 INT8 模型识别音频。
     * @param request 音频路径、模型目录与生命周期回调。
     * @returns 完整文本及子词开始时间轴。
     */
    public async transcribe(request: SpeechRecognitionRequest): Promise<SpeechRecognitionResult> {
        const modelDir = path.join(request.modelsRoot, PARAKEET_MODEL_DIRECTORY);
        const files = {
            encoder: path.join(modelDir, 'encoder.int8.onnx'),
            decoder: path.join(modelDir, 'decoder.int8.onnx'),
            joiner: path.join(modelDir, 'joiner.int8.onnx'),
            tokens: path.join(modelDir, 'tokens.txt'),
        };
        for (const [name, filePath] of Object.entries(files)) {
            if (!fs.existsSync(filePath)) throw new Error(`Parakeet 模型文件缺失（${name}）：${filePath}`);
        }

        const output = await this.cli.run({
            executablePath: this.cli.resolveExecutablePath(),
            args: [
                `--encoder=${files.encoder}`,
                `--decoder=${files.decoder}`,
                `--joiner=${files.joiner}`,
                `--tokens=${files.tokens}`,
                '--model-type=nemo_transducer',
                '--num-threads=2',
                request.audioPath,
            ],
            isCancelled: request.isCancelled,
            onHeartbeat: request.onHeartbeat,
        });
        return {
            text: output.text.trim(),
            tokens: output.tokens.map((text, index) => ({ text, start: output.timestamps[index] })),
        };
    }

    /** 终止当前 sherpa-onnx 进程。 */
    public cancelActive(): void {
        this.cli.killActive();
    }
}
