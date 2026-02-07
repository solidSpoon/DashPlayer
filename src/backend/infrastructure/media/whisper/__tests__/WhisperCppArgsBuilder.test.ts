import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WhisperCppArgsBuilder } from '@/backend/infrastructure/media/whisper/WhisperCppArgsBuilder';

/**
 * 创建临时模型目录并按需写入模型文件。
 */
function createModelsRoot(options: { withWhisperModel: boolean; withVadModel: boolean }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-models-'));
    fs.mkdirSync(path.join(root, 'whisper'), { recursive: true });
    fs.mkdirSync(path.join(root, 'whisper-vad'), { recursive: true });

    if (options.withWhisperModel) {
        fs.writeFileSync(path.join(root, 'whisper', 'ggml-base.bin'), 'model');
        fs.writeFileSync(path.join(root, 'whisper', 'ggml-large-v3.bin'), 'model');
    }
    if (options.withVadModel) {
        fs.writeFileSync(path.join(root, 'whisper-vad', 'ggml-silero-v6.2.0.bin'), 'vad');
    }

    return root;
}

describe('WhisperCppArgsBuilder 参数构建', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('能力与模型齐全时应生成完整参数', () => {
        const modelsRoot = createModelsRoot({ withWhisperModel: true, withVadModel: true });
        const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-out-'));

        const result = WhisperCppArgsBuilder.build({
            helpText: 'usage: whisper-cli --vad --vad-model --print-progress',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
            modelsRoot,
            processedAudioPath: '/tmp/input.wav',
            tempFolder,
        });

        expect(result.vadSkippedBecauseUnsupported).toBe(false);
        expect(result.outSrt).toBe(path.join(tempFolder, 'whispercpp_out.srt'));
        expect(result.args).toContain('--vad');
        expect(result.args).toContain('-vm');
        expect(result.args).toContain('-pp');

        fs.rmSync(modelsRoot, { recursive: true, force: true });
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });

    it('主模型不存在时应抛出中文错误', () => {
        const modelsRoot = createModelsRoot({ withWhisperModel: false, withVadModel: false });
        const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-out-'));

        expect(() => {
            WhisperCppArgsBuilder.build({
                helpText: 'usage: whisper-cli --vad',
                modelSize: 'large',
                enableVad: true,
                vadModel: 'silero-v6.2.0',
                modelsRoot,
                processedAudioPath: '/tmp/input.wav',
                tempFolder,
            });
        }).toThrow('本地 Whisper 模型未下载');

        fs.rmSync(modelsRoot, { recursive: true, force: true });
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });

    it('二进制不支持 VAD 参数时应标记跳过', () => {
        const modelsRoot = createModelsRoot({ withWhisperModel: true, withVadModel: false });
        const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-out-'));

        const result = WhisperCppArgsBuilder.build({
            helpText: 'usage: whisper-cli',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
            modelsRoot,
            processedAudioPath: '/tmp/input.wav',
            tempFolder,
        });

        expect(result.vadSkippedBecauseUnsupported).toBe(true);
        expect(result.args).not.toContain('--vad');

        fs.rmSync(modelsRoot, { recursive: true, force: true });
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });

    it('支持 --vad 但不支持 vad-model 时应仅注入 --vad', () => {
        const modelsRoot = createModelsRoot({ withWhisperModel: true, withVadModel: false });
        const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-out-'));

        const result = WhisperCppArgsBuilder.build({
            helpText: 'usage: whisper-cli --vad',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
            modelsRoot,
            processedAudioPath: '/tmp/input.wav',
            tempFolder,
        });

        expect(result.args).toContain('--vad');
        expect(result.args).not.toContain('-vm');
        expect(result.vadSkippedBecauseUnsupported).toBe(false);

        fs.rmSync(modelsRoot, { recursive: true, force: true });
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });
});
