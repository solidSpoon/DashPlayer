import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { CancelByUserError } from '@/backend/utils/errors/errors';
import { LOG_TAIL_LINES, tailLines } from '@/backend/utils/output-tail';
import type { SpeechRecognitionToken } from '@/backend/services/gateways/media/SpeechRecognitionGateway';

/** token 调试行的时间单位为 10ms，除以该常数得到秒。 */
const TOKEN_TIME_UNIT_MS = 100;

/** stderr 中标记"无核显、静默回退 CPU"的行前缀（输出契约随二进制版本固定）。 */
const GPU_FALLBACK_MARKERS = [
    // 设备枚举不到任何 GPU：parakeet_backend_init_gpu 直接返回空
    'parakeet_backend_init_gpu: no GPU found',
    // 找到 GPU 设备但初始化失败：同样回退 CPU 继续
    'parakeet_backend_init_gpu: failed to initialize',
] as const;

/**
 * 检测本次识别是否发生了"无核显、静默回退 CPU"。
 *
 * whisper.cpp 在枚举不到 Vulkan 设备或设备初始化失败时不报错，
 * 而是回退 CPU 继续识别（exit 0、结果正确、仅速度慢）。为保留
 * "生成慢"类反馈的日志可归因性，在识别成功后按固定标记识别该场景。
 *
 * @param stderr CLI 标准错误全量文本。
 * @returns true 表示本次实际运行在 CPU 模式。
 */
export function detectGpuFallback(stderr: string): boolean {
    return GPU_FALLBACK_MARKERS.some((marker) => stderr.includes(marker));
}

/**
 * whisper.cpp CLI 单次执行请求。
 */
export interface WhisperCppRunRequest {
    /** 模型 GGUF 文件绝对路径。 */
    modelPath: string;
    /** 待识别音频路径（16k 单声道 WAV）。 */
    audioPath: string;
    /** 推理线程数；核显模式下影响很小，CPU 模式下 4 为实测最优。 */
    numThreads: number;
    /** 所属后台任务身份标识。 */
    job?: string;
    /** 取消判定；返回 true 时立即终止识别。 */
    isCancelled?: () => boolean;
    /** 识别进程存活期间的心跳回调。 */
    onHeartbeat?: () => void;
}

/**
 * whisper.cpp CLI 的结构化识别输出。
 */
export interface WhisperCppOutput {
    /** 完整识别文本。 */
    text: string;
    /** 子词时间轴，start 单位为秒。 */
    tokens: SpeechRecognitionToken[];
}

/**
 * 从混合日志中解析 whisper.cpp parakeet-cli 的识别结果。
 *
 * 输出契约（随二进制版本固定）：
 * - stdout 为整段识别文本；
 * - stderr 混有初始化日志、`Segment N: [...]` 汇总行与逐 token 调试行，
 *   token 行形如 `  [ 0] id= 1976 frame=  3 ... t0=  24 t1=  56 word_start=true "▁And"`；
 * - t0/t1 为 10ms 单位的时间戳。
 *
 * @param stdout CLI 标准输出（识别文本）。
 * @param stderr CLI 标准错误（含 token 时间轴调试行）。
 * @returns 严格校验后的识别结果；文本与时间轴缺失或非法时抛错，不做静默兜底。
 */
export function parseWhisperCppOutput(stdout: string, stderr: string): WhisperCppOutput {
    const text = stdout.trim();
    if (!text) {
        throw new Error(`whisper.cpp 未返回识别文本：${stderr.slice(-2000)}`);
    }
    const tokens: SpeechRecognitionToken[] = [];
    const tokenPattern = /^\s*\[\s*\d+\]\s+.*?\bt0=\s*(-?\d+)\s+t1=\s*(-?\d+)\s+word_start=(?:true|false)\s+"(.*)"$/;
    for (const line of stderr.split(/\r?\n/)) {
        const match = tokenPattern.exec(line);
        if (!match) continue;
        const startMs = Number(match[1]);
        const endMs = Number(match[2]);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs < startMs) {
            throw new Error(`whisper.cpp 返回了非法时间戳：${line.trim()}`);
        }
        const tokenText = match[3].replace(/▁/g, ' ');
        if (!tokenText.trim()) {
            // 模型会把句间/词间的空格单独输出为只含 "▁" 的 token（TDT 模型正常现象），
            // 它不携带词文本，只占位时间轴；直接跳过，不能视为数据损坏。
            continue;
        }
        tokens.push({ text: tokenText, start: startMs / TOKEN_TIME_UNIT_MS });
    }
    if (tokens.length === 0) {
        throw new Error(`whisper.cpp 未返回 token 时间轴：${stderr.slice(-2000)}`);
    }
    for (let i = 1; i < tokens.length; i++) {
        if (tokens[i].start < tokens[i - 1].start) {
            throw new Error('whisper.cpp 返回的 token 时间轴不是单调递增的');
        }
    }
    return { text, tokens };
}

/**
 * 管理 whisper.cpp parakeet-cli 的路径解析、执行与取消。
 */
@injectable()
export class WhisperCppCli {
    private readonly logger = getMainLogger('WhisperCpp');

    private activeProcess: ChildProcess | null = null;

    /**
     * 解析当前平台随应用分发的 parakeet-cli 可执行文件。
     * @returns 可执行文件绝对路径。
     */
    public resolveExecutablePath(): string {
        const platformDir = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
        const archDir = process.arch === 'arm64' ? 'arm64' : 'x64';
        const executableName = process.platform === 'win32' ? 'parakeet-cli.exe' : 'parakeet-cli';
        const executablePath = getRuntimeResourcePath('lib', 'whisper-cpp', archDir, platformDir, executableName);
        if (!fs.existsSync(executablePath)) {
            throw new Error(`whisper.cpp 可执行文件不存在：${executablePath}`);
        }
        return executablePath;
    }

    /**
     * 执行一次离线识别并解析结构化输出。
     * @param request 模型路径、音频路径、线程数与任务生命周期回调。
     * @returns 识别文本与子词时间轴。
     */
    public async run(request: WhisperCppRunRequest): Promise<WhisperCppOutput> {
        if (request.isCancelled?.()) {
            throw new CancelByUserError('Transcription cancelled by user');
        }
        const executablePath = this.resolveExecutablePath();

        try {
            return await new Promise<WhisperCppOutput>((resolve, reject) => {
                const child = spawn(executablePath, [
                    '-m', request.modelPath,
                    '-f', request.audioPath,
                    '-t', String(request.numThreads),
                    '--print-segments',
                ], {
                    cwd: path.dirname(executablePath),
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                this.activeProcess = child;
                this.logger.info('spawned whisper.cpp parakeet-cli', {
                    job: request.job,
                    pid: child.pid,
                    audioPath: request.audioPath,
                    modelPath: request.modelPath,
                });
                // stdout 需整体拼接识别文本；stderr 含 token 时间轴调试行，识别成功时按全量解析，
                // 失败时日志只取尾部行，避免错误日志被刷屏。
                let stdout = '';
                let stderr = '';
                child.stdout.on('data', (chunk) => { stdout += String(chunk); });
                child.stderr.on('data', (chunk) => { stderr += String(chunk); });
                const heartbeat = setInterval(() => {
                    if (!request.isCancelled?.()) request.onHeartbeat?.();
                }, 4000);

                child.on('error', (error) => {
                    this.logger.error('whisper.cpp spawn failed', { job: request.job, pid: child.pid, error });
                    reject(error);
                });
                child.on('close', (code, signal) => {
                    clearInterval(heartbeat);
                    if (request.isCancelled?.()) {
                        this.logger.warn('whisper.cpp cancelled', { job: request.job, pid: child.pid, exitCode: code, signal });
                        reject(new CancelByUserError('Transcription cancelled by user'));
                        return;
                    }
                    if (code !== 0) {
                        const exitReason = signal ? `被信号 ${signal} 终止` : `退出码 ${code}`;
                        this.logger.error('whisper.cpp exited abnormally', {
                            job: request.job,
                            pid: child.pid,
                            exitCode: code,
                            signal,
                            // 尾部行数组入日志，避免整段文本被单字段长度上限截掉关键原因。
                            stderrTail: tailLines(stderr, LOG_TAIL_LINES),
                            stdoutTail: tailLines(stdout, LOG_TAIL_LINES),
                        });
                        reject(new Error(`whisper.cpp ${exitReason}：${stderr.slice(-2000)}`));
                        return;
                    }
                    try {
                        if (detectGpuFallback(stderr)) {
                            this.logger.warn('whisper.cpp ran on CPU fallback', {
                                job: request.job,
                                pid: child.pid,
                                // 不中断识别：CPU 回退结果正确仅速度慢，
                                // 日志用于归因"生成慢"类反馈
                                hint: '未检测到可用 Vulkan 设备，已回退 CPU 模式；建议切换 sherpa-onnx 引擎',
                            });
                        }
                        resolve(parseWhisperCppOutput(stdout, stderr));
                    } catch (error) {
                        this.logger.error('whisper.cpp output rejected', {
                            job: request.job,
                            pid: child.pid,
                            error,
                            stderrTail: tailLines(stderr, LOG_TAIL_LINES),
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
}
