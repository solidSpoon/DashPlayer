import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { getMainLogger } from '@/backend/infrastructure/logger';

/**
 * Pi RPC 进程启动配置。
 */
export interface PiRpcClientOptions {
    /** 受管 Pi 可执行文件绝对路径。 */
    executablePath: string;
    /** 进程工作目录（本次下载任务的临时文件夹）。 */
    cwd: string;
    /** 模型提供方标识（如 dashplayer）。 */
    provider: string;
    /** 模型 ID。 */
    modelId: string;
    /** 附加系统提示词文本或文件路径（传给 --append-system-prompt）。 */
    appendSystemPrompt?: string;
    /** 附加环境变量（如 PI_CODING_AGENT_DIR、代理等）。 */
    env?: NodeJS.ProcessEnv;
    /** 收到一条完整的 RPC JSON 记录时的回调。 */
    onRecord: (record: Record<string, unknown>) => void;
    /** 收到 stderr 日志输出时的回调。 */
    onStderr?: (text: string) => void;
    /** 进程退出回调。 */
    onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
    /** 进程启动或管道异常回调。 */
    onError?: (error: Error) => void;
}

/**
 * Pi `--mode rpc` 子进程通信客户端。
 *
 * 按照 Pi RPC 协议要求：
 * - 通过 stdin/stdout 以严格 LF（`\n`）分隔的 JSONL 通信；
 * - 不使用 Node `readline`（避免把字符串内的 `U+2028`/`U+2029` 误判为分隔符）。
 */
export class PiRpcClient {
    private readonly logger = getMainLogger('PiRpcClient');
    private readonly child: ChildProcessWithoutNullStreams;
    private stdoutBuffer = '';
    private reqCounter = 0;
    private disposed = false;

    constructor(private readonly options: PiRpcClientOptions) {
        const args = [
            '--mode', 'rpc',
            '--no-session',
            '--provider', options.provider,
            '--model', options.modelId,
        ];
        if (options.appendSystemPrompt) {
            args.push('--append-system-prompt', options.appendSystemPrompt);
        }

        this.child = spawn(options.executablePath, args, {
            cwd: options.cwd,
            env: {
                ...process.env,
                ...options.env,
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });

        this.child.stdout.setEncoding('utf8');
        this.child.stderr.setEncoding('utf8');

        this.child.stdout.on('data', (chunk: string) => {
            this.handleStdoutChunk(chunk);
        });

        this.child.stderr.on('data', (chunk: string) => {
            if (chunk.length > 0) {
                this.options.onStderr?.(chunk);
            }
        });

        this.child.on('error', (error) => {
            this.logger.error('pi rpc process error', { error: error.message });
            this.options.onError?.(error);
        });

        this.child.on('exit', (code, signal) => {
            if (this.stdoutBuffer.trim().length > 0) {
                this.parseAndEmitLine(this.stdoutBuffer);
                this.stdoutBuffer = '';
            }
            this.options.onExit?.(code, signal);
        });
    }

    /**
     * 发送一条 prompt 指令；若 Agent 正在运行可通过 streamingBehavior 排队或插话。
     * @param message 要发送给 Agent 的提示词或用户指令。
     * @param streamingBehavior 运行中发送时的行为（steer 或 followUp）。
     */
    public prompt(message: string, streamingBehavior?: 'steer' | 'followUp'): void {
        const payload: Record<string, unknown> = {
            id: this.nextRequestId(),
            type: 'prompt',
            message,
        };
        if (streamingBehavior) {
            payload.streamingBehavior = streamingBehavior;
        }
        this.writeCommand(payload);
    }

    /**
     * 请求中止当前正在进行的 Agent 回合。
     */
    public abort(): void {
        this.writeCommand({
            id: this.nextRequestId(),
            type: 'abort',
        });
    }

    /**
     * 优雅关闭 Pi RPC 子进程（先关闭 stdin，超时后发送 SIGTERM）。
     */
    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        try {
            if (!this.child.stdin.destroyed) {
                this.child.stdin.end();
            }
        } catch {
            // 忽略关闭流异常
        }

        const timer = setTimeout(() => {
            if (!this.child.killed) {
                this.child.kill('SIGTERM');
            }
        }, 1500);
        timer.unref?.();
    }

    private nextRequestId(): string {
        this.reqCounter += 1;
        return `dp-rpc-${this.reqCounter}`;
    }

    private writeCommand(command: Record<string, unknown>): void {
        if (this.disposed || this.child.stdin.destroyed) {
            throw new Error('Pi RPC 会话已关闭，无法发送指令');
        }
        this.child.stdin.write(`${JSON.stringify(command)}\n`, 'utf8');
    }

    private handleStdoutChunk(chunk: string): void {
        this.stdoutBuffer += chunk;
        let newlineIndex = this.stdoutBuffer.indexOf('\n');
        while (newlineIndex !== -1) {
            const rawLine = this.stdoutBuffer.slice(0, newlineIndex);
            this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
            this.parseAndEmitLine(rawLine);
            newlineIndex = this.stdoutBuffer.indexOf('\n');
        }
    }

    private parseAndEmitLine(rawLine: string): void {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (line.trim().length === 0) {
            return;
        }
        try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            this.options.onRecord(parsed);
        } catch (error) {
            this.logger.warn('failed to parse pi rpc jsonl line', {
                line: line.slice(0, 200),
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
