import { inject, injectable, unmanaged } from 'inversify';
import * as fs from 'fs';
import * as path from 'path';
import SpeechRecognitionGateway, { SpeechRecognitionRequest, SpeechRecognitionResult } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import TYPES from '@/backend/ioc/types';
import { SherpaOnnxCli } from '@/backend/infrastructure/media/sherpa/SherpaOnnxCli';
import { PARAKEET_MODEL_DIRECTORY } from '@/backend/services/models/parakeetModel';

/**
 * 基于 sherpa-onnx CLI 与 Parakeet v3 的本地英语识别网关。
 */
@injectable()
export default class SherpaOnnxGatewayImpl implements SpeechRecognitionGateway {
    constructor(
        @inject(TYPES.SherpaOnnxCli) private readonly cli: SherpaOnnxCli,
        @unmanaged() private readonly modelDirectory: string = PARAKEET_MODEL_DIRECTORY,
    ) {}

    /**
     * 使用构造时固定的 INT8 模型识别音频，任务中途切换设置不会更换模型。
     * @param request 音频路径、模型目录与生命周期回调。
     * @returns 完整文本及子词时间轴（该引擎只提供开始时间）。
     */
    public async transcribe(request: SpeechRecognitionRequest): Promise<SpeechRecognitionResult> {
        const modelDir = path.join(request.modelsRoot, this.modelDirectory);
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
            args: [
                `--encoder=${files.encoder}`,
                `--decoder=${files.decoder}`,
                `--joiner=${files.joiner}`,
                `--tokens=${files.tokens}`,
                '--model-type=nemo_transducer',
                '--num-threads=2',
                request.audioPath,
            ],
            audioPath: request.audioPath,
            job: request.job,
            isCancelled: request.isCancelled,
            onHeartbeat: request.onHeartbeat,
        });
        return {
            text: output.text.trim(),
            // tokens.txt 沿用 SentencePiece 的 ▁ 词首标记，统一归一化为前导空格，
            // 与 whisper.cpp 网关的子词文本契约保持一致。
            tokens: output.tokens.map((text, index) => ({
                text: text.replace(/▁/g, ' '),
                start: output.timestamps[index],
            })),
        };
    }

    /** 终止当前 sherpa-onnx 进程。 */
    public cancelActive(): void {
        this.cli.killActive();
    }
}
