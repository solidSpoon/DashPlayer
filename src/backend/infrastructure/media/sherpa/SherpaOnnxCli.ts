import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';

/**
 * sherpa-onnx 离线识别器的原始 JSON 输出。
 */
export interface SherpaOnnxOutput {
    /** 完整识别文本。 */
    text: string;
    /** 子词列表。 */
    tokens: string[];
    /** 与子词逐项对应的开始时间，单位为秒。 */
    timestamps: number[];
}

/**
 * 管理 sherpa-onnx CLI 路径、执行与取消。
 */
@injectable()
export class SherpaOnnxCli {
    private activeProcess: ChildProcess | null = null;

    /**
     * 解析当前平台随应用分发的 sherpa-onnx 可执行文件。
     * @returns 可执行文件绝对路径。
     */
    public resolveExecutablePath(): string {
        const platformDir = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
        const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';
        const executableName = process.platform === 'win32' ? 'sherpa-onnx-offline.exe' : 'sherpa-onnx-offline';
        const executablePath = getRuntimeResourcePath('lib', 'sherpa-onnx', archDir, platformDir, executableName);
        if (!fs.existsSync(executablePath)) {
            throw new Error(`sherpa-onnx 可执行文件不存在：${executablePath}`);
        }
        return executablePath;
    }

    /**
     * 执行离线识别并解析 CLI 输出中的 JSON。
     * @param params 可执行文件、参数与任务生命周期回调。
     * @returns sherpa-onnx 的结构化输出。
     */
    public async run(params: {
        executablePath: string;
        args: string[];
        isCancelled?: () => boolean;
        onHeartbeat?: () => void;
    }): Promise<SherpaOnnxOutput> {
        if (params.isCancelled?.()) {
            throw new Error('Transcription cancelled by user');
        }

        try {
            return await new Promise<SherpaOnnxOutput>((resolve, reject) => {
                const child = spawn(params.executablePath, params.args, {
                    cwd: path.dirname(params.executablePath),
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                this.activeProcess = child;
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (chunk) => { stdout += String(chunk); });
                child.stderr.on('data', (chunk) => { stderr += String(chunk); });
                const heartbeat = setInterval(() => {
                    if (!params.isCancelled?.()) params.onHeartbeat?.();
                }, 4000);

                child.on('error', reject);
                child.on('close', (code, signal) => {
                    clearInterval(heartbeat);
                    if (params.isCancelled?.()) {
                        reject(new Error('Transcription cancelled by user'));
                        return;
                    }
                    if (code !== 0) {
                        const exitReason = signal ? `被信号 ${signal} 终止` : `退出码 ${code}`;
                        reject(new Error(`sherpa-onnx ${exitReason}：${stderr.slice(-2000)}`));
                        return;
                    }
                    try {
                        resolve(this.parseOutput(stdout));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        } finally {
            this.activeProcess = null;
        }
    }

    /** 终止当前识别进程。 */
    public killActive(): void {
        this.activeProcess?.kill('SIGKILL');
    }

    /**
     * 从混合日志中提取最后一个合法识别 JSON。
     * @param output CLI 标准输出。
     * @returns 已严格校验的识别结果。
     */
    private parseOutput(output: string): SherpaOnnxOutput {
        const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
        for (const line of lines) {
            if (!line.startsWith('{') || !line.endsWith('}')) continue;
            let value: Partial<SherpaOnnxOutput>;
            try {
                value = JSON.parse(line) as Partial<SherpaOnnxOutput>;
            } catch {
                continue;
            }
            if (typeof value.text !== 'string' || !Array.isArray(value.tokens) || !Array.isArray(value.timestamps)) continue;
            if (value.tokens.length !== value.timestamps.length) {
                throw new Error('sherpa-onnx 返回的 tokens 与 timestamps 数量不一致');
            }
            if (!value.tokens.every((token) => typeof token === 'string') || !value.timestamps.every(Number.isFinite)) {
                throw new Error('sherpa-onnx 返回了非法时间轴');
            }
            return value as SherpaOnnxOutput;
        }
        throw new Error(`sherpa-onnx 未返回识别 JSON：${output.slice(-2000)}`);
    }
}
