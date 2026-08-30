import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import { getMainLogger } from '@/backend/infrastructure/logger';

/** 失败时结构化进日志的子进程输出尾部行数。 */
const STDERR_LOG_TAIL_LINES = 20;

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
 * sherpa-onnx CLI 单次执行请求。
 */
export interface SherpaOnnxRunRequest {
    /** CLI 参数列表，末位为待识别音频。 */
    args: string[];
    /** 待识别音频路径，用于日志归因。 */
    audioPath: string;
    /** 所属后台任务身份标识。 */
    job?: string;
    /** 取消判定；返回 true 时立即终止识别。 */
    isCancelled?: () => boolean;
    /** 识别进程存活期间的心跳回调。 */
    onHeartbeat?: () => void;
}

/**
 * 管理 sherpa-onnx CLI 路径、执行与取消。
 */
@injectable()
export class SherpaOnnxCli {
    private readonly logger = getMainLogger('SherpaOnnx');

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
     * @param request 模型目录、音频路径、CLI 参数与任务生命周期回调。
     * @returns sherpa-onnx 的结构化输出。
     */
    public async run(request: SherpaOnnxRunRequest): Promise<SherpaOnnxOutput> {
        if (request.isCancelled?.()) {
            throw new Error('Transcription cancelled by user');
        }
        const executablePath = this.resolveExecutablePath();

        try {
            return await new Promise<SherpaOnnxOutput>((resolve, reject) => {
                const child = spawn(executablePath, request.args, {
                    cwd: path.dirname(executablePath),
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                this.activeProcess = child;
                this.logger.info('spawned sherpa-onnx', {
                    job: request.job,
                    pid: child.pid,
                    audioPath: request.audioPath,
                });
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (chunk) => { stdout += String(chunk); });
                child.stderr.on('data', (chunk) => { stderr += String(chunk); });
                const heartbeat = setInterval(() => {
                    if (!request.isCancelled?.()) request.onHeartbeat?.();
                }, 4000);

                child.on('error', (error) => {
                    this.logger.error('sherpa-onnx spawn failed', { job: request.job, pid: child.pid, error });
                    reject(error);
                });
                child.on('close', (code, signal) => {
                    clearInterval(heartbeat);
                    if (request.isCancelled?.()) {
                        this.logger.warn('sherpa-onnx cancelled', { job: request.job, pid: child.pid, exitCode: code, signal });
                        reject(new Error('Transcription cancelled by user'));
                        return;
                    }
                    if (code !== 0) {
                        const exitReason = signal ? `被信号 ${signal} 终止` : `退出码 ${code}`;
                        this.logger.error('sherpa-onnx exited abnormally', {
                            job: request.job,
                            pid: child.pid,
                            exitCode: code,
                            signal,
                            // 尾部行数组入日志，避免整段文本被单字段长度上限截掉关键原因。
                            stderrTail: this.tailLines(stderr),
                            stdoutTail: this.tailLines(stdout),
                        });
                        reject(new Error(`sherpa-onnx ${exitReason}：${stderr.slice(-2000)}`));
                        return;
                    }
                    try {
                        resolve(this.parseOutput(stdout));
                    } catch (error) {
                        this.logger.error('sherpa-onnx output rejected', {
                            job: request.job,
                            pid: child.pid,
                            error,
                            stdoutTail: this.tailLines(stdout),
                        });
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
     * 取输出末尾若干非空行，用于结构化日志。
     * @param text 子进程累计输出文本。
     * @returns 最多 {@link STDERR_LOG_TAIL_LINES} 行尾部文本。
     */
    private tailLines(text: string): string[] {
        return text.split(/\r?\n/).filter(Boolean).slice(-STDERR_LOG_TAIL_LINES);
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
