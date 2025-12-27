import * as fs from 'fs';
import * as path from 'path';

export type WhisperCppArgsBuildResult = {
    args: string[];
    outPrefix: string;
    outSrt: string;
    vadSkippedBecauseUnsupported: boolean;
};

export class WhisperCppArgsBuilder {
    public static build(params: {
        helpText: string;
        modelSize: 'base' | 'large';
        enableVad: boolean;
        vadModel: 'silero-v5.1.2' | 'silero-v6.2.0';
        modelsRoot: string;
        processedAudioPath: string;
        tempFolder: string;
    }): WhisperCppArgsBuildResult {
        const {helpText, modelSize, enableVad, vadModel, modelsRoot, processedAudioPath, tempFolder} = params;

        const supportsVadFlag = /--vad\b/.test(helpText);
        const supportsVadModelFlag = /\s-vm\b/.test(helpText) || /--vad-model\b/.test(helpText);
        const supportsPrintProgress = helpText.includes('--print-progress') || helpText.includes('-pp');

        const whisperModelTag = modelSize === 'large' ? 'large-v3' : 'base';
        const modelPath = path.join(modelsRoot, 'whisper', `ggml-${whisperModelTag}.bin`);
        if (!fs.existsSync(modelPath)) {
            throw new Error(`本地 Whisper 模型未下载：${modelSize}。请在【设置 → 服务配置 → Whisper 本地字幕识别】中下载模型后再转录。`);
        }

        let vadModelPath: string | null = null;
        let vadSkippedBecauseUnsupported = false;
        if (enableVad) {
            if (!supportsVadFlag) {
                vadSkippedBecauseUnsupported = true;
            } else if (supportsVadModelFlag) {
                vadModelPath = path.join(modelsRoot, 'whisper-vad', `ggml-${vadModel}.bin`);
                if (!fs.existsSync(vadModelPath)) {
                    throw new Error(`静音检测模型未下载。请在【设置 → 服务配置 → Whisper 本地字幕识别】中下载静音检测模型后再转录。`);
                }
            }
        }

        const outPrefix = path.join(tempFolder, 'whispercpp_out');
        const outSrt = `${outPrefix}.srt`;

        const args: string[] = [
            '-m', modelPath,
            '-f', processedAudioPath,
            '-l', 'auto',
            '-osrt',
            '-of', outPrefix,
            ...(supportsPrintProgress ? ['-pp'] : []),
        ];

        if (enableVad && supportsVadFlag) {
            args.push('--vad');
            if (vadModelPath && supportsVadModelFlag) {
                args.push('-vm', vadModelPath);
            }
        }

        return {
            args,
            outPrefix,
            outSrt,
            vadSkippedBecauseUnsupported,
        };
    }
}
