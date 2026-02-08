import { ChildProcess, spawn } from 'child_process';

/**
 * FFmpeg 执行请求。
 */
export interface FfmpegRunRequest {
    /** FFmpeg 可执行文件路径。 */
    ffmpegPath: string;
    /** FFmpeg 参数列表。 */
    args: string[];
    /** 输入媒体总时长，单位秒；用于估算百分比进度。 */
    inputDurationSecond?: number;
    /** 进程工作目录；默认使用当前进程目录。 */
    cwd?: string;
}

/**
 * FFmpeg 运行进度事件。
 */
export interface FfmpegProgressEvent {
    /** 已处理时间点，单位秒。 */
    timeSecond: number;
    /** 估算百分比，范围 0~100。 */
    percent?: number;
    /** 原始进度行文本，便于诊断。 */
    rawLine: string;
}

/**
 * FFmpeg 运行结果。
 */
export interface FfmpegRunResult {
    /** 进程退出码。 */
    exitCode: number;
    /** 最近保留的 stderr 行。 */
    stderrTail: string[];
    /** 执行耗时，单位毫秒。 */
    durationMs: number;
}

/**
 * FFmpeg 可取消任务句柄。
 */
export interface FfmpegRunningTask {
    /** 命令执行结果 Promise。 */
    result: Promise<FfmpegRunResult>;
    /** 优雅取消运行中的进程。 */
    cancel: () => void;
}

/**
 * FFmpeg 运行时事件回调。
 */
export interface FfmpegRunHooks {
    /** 命令启动时触发，提供完整命令行字符串。 */
    onStart?: (commandLine: string) => void;
    /** 接收到 stderr 行时触发。 */
    onStderrLine?: (line: string) => void;
    /** 解析到进度信息时触发。 */
    onProgress?: (event: FfmpegProgressEvent) => void;
}

/**
 * 统一 FFmpeg 进程执行器。
 */
export class FfmpegProcessRunner {
    /**
     * 启动一个可取消的 FFmpeg 任务。
     */
    public start(request: FfmpegRunRequest, hooks: FfmpegRunHooks = {}): FfmpegRunningTask {
        const startedAt = Date.now();
        const stderrTail: string[] = [];

        /** 用于跟踪当前子进程，便于取消时发送信号。 */
        let processRef: ChildProcess | null = null;

        const result = new Promise<FfmpegRunResult>((resolve, reject) => {
            const child = spawn(request.ffmpegPath, request.args, {
                cwd: request.cwd,
                stdio: ['ignore', 'ignore', 'pipe'],
            });
            processRef = child;

            hooks.onStart?.(this.composeCommandLine(request.ffmpegPath, request.args));

            child.stderr.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                for (const line of text.split(/\r?\n/).filter(Boolean)) {
                    this.appendTail(stderrTail, line, 120);
                    hooks.onStderrLine?.(line);
                    const progress = this.tryParseProgress(line, request.inputDurationSecond);
                    if (progress) {
                        hooks.onProgress?.(progress);
                    }
                }
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                const exitCode = code ?? -1;
                const durationMs = Date.now() - startedAt;
                if (exitCode === 0) {
                    resolve({
                        exitCode,
                        stderrTail: stderrTail.slice(),
                        durationMs,
                    });
                    return;
                }

                const stderrBlock = stderrTail.join('\n');
                reject(new Error(`FFmpeg 退出码 ${exitCode}\n${stderrBlock}`));
            });
        });

        const cancel = () => {
            if (!processRef || processRef.killed) return;
            processRef.kill('SIGTERM');
            setTimeout(() => {
                if (!processRef || processRef.killed) return;
                processRef.kill('SIGKILL');
            }, 1200);
        };

        return { result, cancel };
    }

    /**
     * 以 Promise 形式执行 FFmpeg 命令。
     */
    public async run(request: FfmpegRunRequest, hooks: FfmpegRunHooks = {}): Promise<FfmpegRunResult> {
        return await this.start(request, hooks).result;
    }

    /**
     * 组合可读命令行，主要用于日志展示。
     */
    private composeCommandLine(ffmpegPath: string, args: string[]): string {
        const allParts = [ffmpegPath, ...args];
        return allParts.map(part => this.quotePart(part)).join(' ');
    }

    /**
     * 对命令参数做最小化转义，避免日志中空格歧义。
     */
    private quotePart(part: string): string {
        if (!part.includes(' ')) return part;
        return `"${part.replace(/"/g, '\\"')}"`;
    }

    /**
     * 维护固定长度的 stderr 尾部缓存。
     */
    private appendTail(lines: string[], line: string, maxLines: number): void {
        lines.push(line);
        if (lines.length > maxLines) {
            lines.shift();
        }
    }

    /**
     * 从 stderr 行中解析进度时间并估算百分比。
     */
    private tryParseProgress(line: string, inputDurationSecond?: number): FfmpegProgressEvent | null {
        const timeMatch = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
        if (!timeMatch) return null;

        const hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);
        const second = Number(timeMatch[3]);
        const timeSecond = hour * 3600 + minute * 60 + second;
        const durationSecond = inputDurationSecond;

        if (typeof durationSecond !== 'number' || !Number.isFinite(durationSecond) || durationSecond <= 0) {
            return {
                timeSecond,
                rawLine: line,
            };
        }

        const percent = Math.max(0, Math.min(100, (timeSecond / durationSecond) * 100));
        return {
            timeSecond,
            percent,
            rawLine: line,
        };
    }
}
