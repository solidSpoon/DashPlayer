import { inject, injectable } from 'inversify';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import axios from 'axios';
import { z } from 'zod';
import TYPES from '@/backend/ioc/types';
import type LocalAiService from '@/backend/services/LocalAiService';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';
import { concurrency } from '@/backend/utils/concurrency';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { LOCAL_AI_MODEL_ID, LocalAiStatus } from '@/common/contracts/local-ai';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';

const MODEL_FILE = 'Qwen3-1.7B-Q4_K_M.gguf';
const MODEL_BYTES = 1107409472;
const MODEL_SHA256 = 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897';
const MODEL_URL = 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/d7f544eead698dbd1f15126ef60b45a1e1933222/Qwen3-1.7B-Q4_K_M.gguf';
const responseSchema = z.object({ choices: z.array(z.object({
    finish_reason: z.literal('stop'),
    message: z.object({ content: z.string().min(1) }),
})).length(1) });

/**
 * 管理固定 GGUF 模型和应用私有的 llama-server 子进程。
 * 推理串行执行；完整校验后原子安装，空闲五分钟释放模型。
 */
@injectable()
export class LocalAiRuntime implements LocalAiService {
    private readonly logger = getMainLogger('LocalAiRuntime');
    private child: ChildProcess | null = null;
    private childExit: Promise<void> | null = null;
    private endpoint: string | null = null;
    private loadedPath: string | null = null;
    private readonly apiKey = randomBytes(32).toString('hex');
    private activeDownload: Promise<void> | null = null;
    private downloadAbort: AbortController | null = null;
    private readonly lifetime = new AbortController();
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private busy = 0;
    private phase: LocalAiStatus['phase'] = 'idle';
    private downloaded = 0;
    private error: string | null = null;
    private lastProgressAt = 0;

    /** 注入模型目录与 renderer 通知边界。 */
    public constructor(
        @inject(TYPES.StorageDirectoryProvider) private readonly directories: StorageDirectoryProvider,
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
    ) {}

    /** 解析当前媒体库中的固定模型路径。 */
    private async modelPath(): Promise<string> {
        return path.join(await this.directories.provideDirectory(StorageDirectoryTarget.MODELS), LOCAL_AI_MODEL_ID, MODEL_FILE);
    }

    /** 只使用明确支持的平台包；缺失的运行时由设置页显式展示。 */
    private runtimePath(): string {
        return getRuntimeResourcePath('lib', 'llama', 'b10819', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
    }

    /** 返回各平台官方运行包中必须与 llama-server 同目录存在的动态库。 */
    private async runtimeDependencyReady(): Promise<boolean> {
        const directory = path.dirname(this.runtimePath());
        const prefix = process.platform === 'darwin' ? 'libmtmd' : process.platform === 'win32' ? 'mtmd' : 'libmtmd';
        try {
            const entries = await fs.promises.readdir(directory);
            return entries.includes('.complete') && entries.some((file) => file.startsWith(prefix) && (file.endsWith('.dylib') || file.endsWith('.so') || file.endsWith('.dll')));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw error;
        }
    }

    /** 推送节流后的下载快照；阶段变化和终态始终立即发出。 */
    private emitProgress(force = false): void {
        const now = Date.now();
        if (!force && now - this.lastProgressAt < 100) return;
        this.lastProgressAt = now;
        this.rendererGateway.fireAndForget('settings/local-ai-model-download-progress', {
            percent: this.downloaded > 0 ? Math.min(100, this.downloaded / MODEL_BYTES * 100) : 0,
            downloaded: this.downloaded,
            total: MODEL_BYTES,
            phase: this.phase,
        });
    }

    /** 查询普通文件大小；只有不存在属于正常未安装状态。 */
    private async fileSize(file: string): Promise<number> {
        try {
            const stat = await fs.promises.stat(file);
            if (!stat.isFile()) throw new Error(`模型路径不是文件：${file}`);
            return stat.size;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
            throw error;
        }
    }

    /** 返回完整的安装和下载快照，页面重新进入时可以恢复进度。 */
    public async getStatus(): Promise<LocalAiStatus> {
        const modelPath = await this.modelPath();
        return {
            ready: await this.fileSize(modelPath) === MODEL_BYTES,
            runtimeReady: await this.fileSize(this.runtimePath()) > 0
                && await this.runtimeDependencyReady(),
            running: this.child !== null,
            phase: this.phase,
            downloaded: this.phase === 'idle' ? await this.fileSize(`${modelPath}.part`) : this.downloaded,
            total: MODEL_BYTES,
            modelPath,
            downloadUrl: MODEL_URL,
            error: this.error,
        };
    }

    /** 启动下载并保留唯一任务；错误保存在状态中，切页后仍可查看。 */
    public async download(): Promise<void> {
        this.lifetime.signal.throwIfAborted();
        if (this.activeDownload) return this.activeDownload;
        if (this.busy > 0) throw new Error('本地模型正在使用，请稍后下载');
        this.phase = 'downloading';
        this.error = null;
        this.downloadAbort = new AbortController();
        this.emitProgress(true);
        const signal = AbortSignal.any([this.downloadAbort.signal, this.lifetime.signal]);
        this.activeDownload = this.install(signal);
        try {
            await this.activeDownload;
        } catch (error) {
            if (!signal.aborted) {
                this.error = error instanceof Error ? error.message : String(error);
                this.logger.error('local model download failed', { error });
            }
            throw error;
        } finally {
            this.phase = 'idle';
            this.activeDownload = null;
            this.downloadAbort = null;
            this.emitProgress(true);
        }
    }

    /** 下载固定版本，验证长度和 SHA256 后再原子重命名；损坏数据显式报错。 */
    private async install(signal: AbortSignal): Promise<void> {
        const modelPath = await this.modelPath();
        if (await this.fileSize(modelPath) === MODEL_BYTES) return;
        const partial = `${modelPath}.part`;
        await fs.promises.mkdir(path.dirname(modelPath), { recursive: true });
        const existing = await this.fileSize(partial);
        if (existing > MODEL_BYTES) throw new Error('未完成模型文件大小异常，请删除模型后重新下载');
        this.downloaded = existing;
        this.logger.info('local model download started', { model: LOCAL_AI_MODEL_ID, downloaded: existing });
        if (existing < MODEL_BYTES) {
            const response = await axios.get(MODEL_URL, {
                responseType: 'stream', signal, timeout: 60_000,
                headers: existing > 0 ? { Range: `bytes=${existing}-` } : {},
            });
            const resumed = response.status === 206;
            if (resumed && response.headers['content-range'] !== `bytes ${existing}-${MODEL_BYTES - 1}/${MODEL_BYTES}`) {
                response.data.destroy();
                throw new Error('模型下载服务器返回了错误的续传范围');
            }
            if (!resumed) this.downloaded = 0;
            response.data.on('data', (chunk: Buffer) => {
                this.downloaded += chunk.length;
                this.emitProgress();
            });
            await pipeline(response.data, fs.createWriteStream(partial, { flags: resumed ? 'a' : 'w' }), { signal });
        }
        if (await this.fileSize(partial) !== MODEL_BYTES) throw new Error('模型下载不完整，请继续下载');
        this.phase = 'verifying';
        this.emitProgress(true);
        const hash = createHash('sha256');
        const stream = fs.createReadStream(partial, { signal });
        for await (const chunk of stream) hash.update(chunk);
        if (hash.digest('hex') !== MODEL_SHA256) throw new Error('模型 SHA256 校验失败，请删除模型后重新下载');
        signal.throwIfAborted();
        await fs.promises.rename(partial, modelPath);
        this.logger.info('local model installed', { model: LOCAL_AI_MODEL_ID });
    }

    /** 等待取消完成后再允许重试，避免多个写入器同时操作续传文件。 */
    public async cancelDownload(): Promise<void> {
        const task = this.activeDownload;
        if (!task) return;
        this.downloadAbort?.abort();
        await task.catch((error) => {
            if (!axios.isCancel(error) && error?.name !== 'AbortError') throw error;
        });
    }

    /** 删除安装文件及续传数据；先释放已加载的模型。 */
    public async deleteModel(): Promise<void> {
        if (this.activeDownload || this.busy > 0) throw new Error('模型正在下载或使用，请稍后删除');
        this.busy++;
        try {
            await this.stop();
            const modelPath = await this.modelPath();
            await fs.promises.rm(modelPath, { force: true });
            await fs.promises.rm(`${modelPath}.part`, { force: true });
            this.error = null;
            this.downloaded = 0;
        } finally { this.busy--; }
    }

    /** 申请回环动态端口；进程绑定失败会显式报告，不连接其他本地服务。 */
    private async reservePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                const address = server.address();
                if (!address || typeof address === 'string') { server.close(); reject(new Error('无法申请本地推理端口')); return; }
                server.close((error) => error ? reject(error) : resolve(address.port));
            });
        });
    }

    /** 按需加载模型，使用随机鉴权密钥并等待就绪；加载失败会结束子进程。 */
    private async start(signal: AbortSignal): Promise<string> {
        const modelPath = await this.modelPath();
        if (this.endpoint && this.loadedPath === modelPath && this.child) return this.endpoint;
        await this.stop();
        const status = await this.getStatus();
        if (!status.ready) throw new Error('本地 Qwen 模型未安装，请前往服务凭据下载');
        if (!status.runtimeReady) throw new Error('llama.cpp 运行时缺失，请重新执行 yarn run download 或重新安装应用');
        const port = await this.reservePort();
        signal.throwIfAborted();
        const endpoint = `http://127.0.0.1:${port}`;
        const child = spawn(this.runtimePath(), [
            '--model', modelPath, '--host', '127.0.0.1', '--port', String(port),
            '--ctx-size', '8192', '--parallel', '1', '--jinja', '--no-webui',
            '--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning-budget', '0',
            '--n-gpu-layers', process.platform === 'darwin' && process.arch === 'arm64' ? '99' : '0',
        ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, LLAMA_API_KEY: this.apiKey } });
        this.child = child;
        let failure: Error | null = null;
        const stderrTail: string[] = [];
        child.stderr?.on('data', (chunk: Buffer) => {
            stderrTail.push(...chunk.toString().split('\n').map((line) => line.slice(-1000)));
            if (stderrTail.length > 20) stderrTail.splice(0, stderrTail.length - 20);
        });
        child.once('error', (error) => { failure = error; });
        this.childExit = new Promise((resolve) => child.once('close', (code, exitSignal) => {
            if (this.child === child) {
                this.child = null; this.endpoint = null; this.loadedPath = null;
                this.logger.error('local runtime exited unexpectedly', { code, exitSignal, stderrTail });
            }
            failure = failure ?? new Error(`本地推理进程退出：${code ?? exitSignal}`);
            resolve();
        }));
        this.logger.info('local runtime started', { pid: child.pid, model: LOCAL_AI_MODEL_ID });
        const loadingSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
        try {
            for (;;) {
                loadingSignal.throwIfAborted();
                if (failure) throw failure;
                try {
                    const response = await axios.get(`${endpoint}/health`, {
                        proxy: false, signal: loadingSignal, timeout: 1000,
                        headers: { Authorization: `Bearer ${this.apiKey}` },
                    });
                    if (response.data?.status !== 'ok') throw new Error('本地推理健康检查响应无效');
                    this.endpoint = endpoint; this.loadedPath = modelPath;
                    return endpoint;
                } catch (error) {
                    if (!axios.isAxiosError(error) || !['ECONNREFUSED', 'ECONNABORTED'].includes(error.code ?? '') && error.response?.status !== 503) throw error;
                }
                await delay(250, undefined, { signal: loadingSignal });
            }
        } catch (error) {
            this.logger.error('local runtime load failed', { error, stderrTail });
            await this.stop();
            throw error;
        }
    }

    /** 串行生成，限制上下文和输出长度；仅接受完整结束且可解析的 JSON。 */
    public async generate(prompt: string, schema: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
        if (this.activeDownload) throw new Error('本地模型正在安装');
        const combined = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(300_000), ...(signal ? [signal] : [])]);
        this.busy++;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        try {
            return await concurrency.withSemaphore('localAi', async () => {
                const endpoint = await this.start(combined);
                const startedAt = Date.now();
                try {
                    const response = await axios.post(`${endpoint}/v1/chat/completions`, {
                        model: LOCAL_AI_MODEL_ID,
                        messages: [{ role: 'user', content: prompt }],
                        stream: false, temperature: 0.6, top_p: 0.95, top_k: 20,
                        max_tokens: 2048,
                        response_format: { type: 'json_object', schema },
                        chat_template_kwargs: { enable_thinking: false },
                    }, { proxy: false, signal: combined, timeout: 180_000, headers: { Authorization: `Bearer ${this.apiKey}` } });
                    const result = responseSchema.parse(response.data);
                    const parsed: unknown = JSON.parse(result.choices[0].message.content);
                    this.logger.info('local generation completed', { model: LOCAL_AI_MODEL_ID, durationMs: Date.now() - startedAt });
                    return parsed;
                } catch (error) {
                    this.logger.error('local generation failed', { error, durationMs: Date.now() - startedAt });
                    await this.stop();
                    throw error;
                }
            }, { signal: combined });
        } finally {
            this.busy--;
            if (this.busy === 0 && !this.lifetime.signal.aborted) {
                this.idleTimer = setTimeout(() => { void this.stop().catch((error) => this.logger.error('local runtime stop failed', { error })); }, 300_000);
                this.idleTimer.unref();
            }
        }
    }

    /** 结束私有子进程并等待文件句柄释放；超时强制终止。 */
    private async stop(): Promise<void> {
        if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
        const child = this.child;
        const exited = this.childExit;
        this.child = null; this.endpoint = null; this.loadedPath = null;
        if (!child) return;
        child.kill();
        const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
        try { await exited; } finally { clearTimeout(timer); }
        this.logger.info('local runtime stopped', { pid: child.pid });
    }

    /** 应用退出时取消全部工作并等待模型文件、子进程释放。 */
    public async shutdown(): Promise<void> {
        this.lifetime.abort();
        await this.cancelDownload();
        await this.stop();
    }
}
