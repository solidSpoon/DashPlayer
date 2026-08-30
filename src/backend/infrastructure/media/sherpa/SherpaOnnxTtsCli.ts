import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import { getMainLogger } from '@/backend/infrastructure/logger';

/** 进程存活期内在内存中保留的 stderr 尾部行数上限。 */
const STDERR_BUFFER_LINES = 120;

/** 失败时结构化进日志的子进程输出尾部行数。 */
const STDERR_LOG_TAIL_LINES = 20;

/**
 * 调用随应用分发的 Sherpa-ONNX TTS 命令行程序。
 */
@injectable()
export class SherpaOnnxTtsCli {
    private readonly logger = getMainLogger('SherpaTts');

    /**
     * 解析当前平台的 TTS 可执行文件。
     * @returns TTS 可执行文件绝对路径。
     */
    public resolveExecutablePath(): string {
        const platformDir = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
        const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';
        const executableName = process.platform === 'win32' ? 'sherpa-onnx-offline-tts.exe' : 'sherpa-onnx-offline-tts';
        const executablePath = getRuntimeResourcePath('lib', 'sherpa-onnx', archDir, platformDir, executableName);
        if (!fs.existsSync(executablePath)) throw new Error(`sherpa-onnx TTS 可执行文件不存在：${executablePath}`);
        return executablePath;
    }

    /**
     * 合成一段 WAV 音频。
     * @param params TTS 模型文件、输入文本和输出路径。
     * @returns 生成的音频文件路径。
     */
    public async run(params: {
        modelPath: string;
        tokensPath: string;
        dataDir: string;
        outputPath: string;
        text: string;
    }): Promise<string> {
        const executablePath = this.resolveExecutablePath();
        const args = [
            `--vits-model=${params.modelPath}`,
            `--vits-tokens=${params.tokensPath}`,
            `--vits-data-dir=${params.dataDir}`,
            `--output-filename=${params.outputPath}`,
            params.text,
        ];
        await new Promise<void>((resolve, reject) => {
            const child = spawn(executablePath, args, {
                cwd: path.dirname(executablePath),
                stdio: ['ignore', 'ignore', 'pipe'],
            });
            this.logger.info('spawned sherpa-onnx tts', {
                pid: child.pid,
                outputPath: params.outputPath,
                textLength: params.text.length,
            });
            const stderrLines: string[] = [];
            let stderr = '';
            child.stderr.on('data', (chunk) => {
                const text = String(chunk);
                stderr += text;
                for (const line of text.split(/\r?\n/).filter(Boolean)) {
                    stderrLines.push(line);
                    if (stderrLines.length > STDERR_BUFFER_LINES) {
                        stderrLines.shift();
                    }
                }
            });
            child.on('error', (error) => {
                this.logger.error('sherpa-onnx tts spawn failed', { pid: child.pid, error });
                reject(error);
            });
            child.on('close', (code, signal) => {
                if (code === 0) {
                    resolve();
                    return;
                }
                this.logger.error('sherpa-onnx tts exited abnormally', {
                    pid: child.pid,
                    exitCode: code,
                    signal,
                    outputPath: params.outputPath,
                    // 尾部行数组入日志，避免整段文本被单字段长度上限截掉关键原因。
                    stderrTail: stderrLines.slice(-STDERR_LOG_TAIL_LINES),
                });
                reject(new Error(`sherpa-onnx TTS ${signal ? `被信号 ${signal} 终止` : `退出码 ${code}`}：${stderr.slice(-2000)}`));
            });
        });
        if (!fs.existsSync(params.outputPath)) {
            this.logger.error('sherpa-onnx tts produced no audio file', { outputPath: params.outputPath });
            throw new Error('sherpa-onnx TTS 未生成音频文件');
        }
        return params.outputPath;
    }
}
