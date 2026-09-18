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

/** Windows 随包运行库清单：与 release.yml / scripts/download.mjs 的打包契约一致，改随包清单要同步这里。 */
const WINDOWS_RUNTIME_DLLS = ['vulkan-1.dll', 'vcomp140.dll'] as const;

/**
 * Windows NTSTATUS 异常退出码（8 位十六进制小写）→ 可读原因。
 * parakeet-cli 在加载期失败时 stderr 为空，用户与日志能看到的只有裸退出码，必须翻译。
 */
const NTSTATUS_EXIT_REASONS: Record<string, string> = {
    'c0000135': '缺少必需的 DLL（进程在加载期被系统终止）',
    'c000007b': '映像格式错误（DLL 与系统架构不匹配或文件损坏）',
    'c0000142': 'DLL 初始化失败',
    'c000001d': '执行了非法指令（二进制损坏或 CPU 不支持）',
    'c0000005': '内存访问冲突（程序内部错误）',
};

/** "找不到 DLL"类退出码：对它进一步探测引擎目录，指名报出缺失的随包文件。 */
const DLL_NOT_FOUND_EXIT_CODE = 'c0000135';

/**
 * 把异常退出码翻译成可读原因与修复指引（Windows NTSTATUS 专用）。
 *
 * parakeet-cli 在加载期失败（如随包 DLL 被清理或损坏）时 stderr 为空，
 * 只剩裸退出码可读；对"找不到 DLL"类退出码探测引擎目录，指名报出缺失的
 * 随包文件。按"显式报错、不静默兜底"的约定只给修复指引，不自动补件。
 *
 * @param code 子进程退出码；Windows 上可能以无符号（3221225781）或有符号（-1073741515）出现。
 * @param engineDir parakeet-cli 所在目录（随包 DLL 的落地位置）。
 * @returns 可读诊断文本；非 NTSTATUS 退出码时返回 null，不猜测原因。
 */
export function describeAbnormalExit(code: number | null, engineDir: string): string | null {
    if (code === null) return null;
    const hex = (code >>> 0).toString(16).padStart(8, '0');
    const reason = NTSTATUS_EXIT_REASONS[hex];
    if (!reason) return null;
    const parts = [`0x${hex.toUpperCase()} ${reason}`];
    if (hex === DLL_NOT_FOUND_EXIT_CODE) {
        const missing = WINDOWS_RUNTIME_DLLS.filter((name) => !fs.existsSync(path.join(engineDir, name)));
        parts.push(
            missing.length > 0
                ? `引擎目录缺少 ${missing.join('、')}，可能被杀毒软件清理或安装不完整`
                : '引擎目录里应用自带的运行库文件齐全，可能是文件损坏或被安全软件拦截'
        );
        parts.push('请重新安装应用');
    }
    return parts.join('；');
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
    /** 子词时间轴，start/end 单位为秒。 */
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
        tokens.push({ text: tokenText, start: startMs / TOKEN_TIME_UNIT_MS, end: endMs / TOKEN_TIME_UNIT_MS });
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
                    // spawn 失败时 close 可能不触发，这里也要清理心跳，避免定时器空转泄漏。
                    clearInterval(heartbeat);
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
                        // 加载期失败（如缺 DLL）时 stderr 为空，翻译后的原因让这条日志自身可读。
                        const diagnosis = describeAbnormalExit(code, path.dirname(executablePath));
                        this.logger.error('whisper.cpp exited abnormally', {
                            job: request.job,
                            pid: child.pid,
                            exitCode: code,
                            signal,
                            ...(diagnosis !== null && { hint: diagnosis }),
                            // 尾部行数组入日志，避免整段文本被单字段长度上限截掉关键原因。
                            stderrTail: tailLines(stderr, LOG_TAIL_LINES),
                            stdoutTail: tailLines(stdout, LOG_TAIL_LINES),
                        });
                        // 诊断放在 stderr 之前：加载期失败时 stderr 为空，它是唯一可读的原因线索。
                        const stderrText = stderr.slice(-2000).trim();
                        const details = [diagnosis, stderrText].filter(Boolean).join('；');
                        reject(new Error(`whisper.cpp ${exitReason}${details ? `：${details}` : ''}`));
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
