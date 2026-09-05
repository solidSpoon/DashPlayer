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
import type { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import {
    LOCAL_AI_MODELS,
    LocalAiModelDefinition,
    LocalAiStatus,
    requireLocalAiModel,
} from '@/common/contracts/local-ai';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';

const responseSchema = z.object({ choices: z.array(z.object({
    finish_reason: z.literal('stop'),
    message: z.object({ content: z.string().min(1) }),
})).length(1) });

/**
 * 管理目录内多个 GGUF 模型和应用私有的 llama-server 子进程。
 * 推理串行执行；完整校验后原子安装，空闲五分钟释放模型；
 * 同一时间只允许一个模型下载任务，删除前必须先释放推理进程。
 */
@injectable()
export class LocalAiRuntime implements LocalAiService {
    private readonly logger = getMainLogger('LocalAiRuntime');
    private child: ChildProcess | null = null;
    private childExit: Promise<void> | null = null;
    private endpoint: string | null = null;
    private loadedPath: string | null = null;
    private readonly apiKey = randomBytes(32).toString('hex');
    private activeDownload: { modelId: string; task: Promise<void>; abort: AbortController } | null = null;
    private readonly lifetime = new AbortController();
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private busy = 0;
    private phase: LocalAiStatus['models'][number]['phase'] = 'idle';
    private downloaded = 0;
    /** 每个模型最近一次下载失败原因；成功后清除，切页后仍可查看。 */
    private readonly modelErrors = new Map<string, string>();
    private lastProgressAt = 0;

    /** 注入模型目录、设置存储和 renderer 通知边界。 */
    public constructor(
        @inject(TYPES.StorageDirectoryProvider) private readonly directories: StorageDirectoryProvider,
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.SettingsStore) private readonly settingsStore: SettingsStore,
    ) {}

    /** 解析指定目录模型在媒体库中的安装路径。 */
    private async modelPath(model: LocalAiModelDefinition): Promise<string> {
        return path.join(await this.directories.provideDirectory(StorageDirectoryTarget.MODELS), model.id, model.file);
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
    private emitProgress(modelId: string, force = false): void {
        const now = Date.now();
        if (!force && now - this.lastProgressAt < 100) return;
        this.lastProgressAt = now;
        const model = requireLocalAiModel(modelId);
        this.rendererGateway.fireAndForget('settings/local-ai-model-download-progress', {
            modelId,
            percent: this.downloaded > 0 ? Math.min(100, this.downloaded / model.bytes * 100) : 0,
            downloaded: this.downloaded,
            total: model.bytes,
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
        const models = await Promise.all(LOCAL_AI_MODELS.map(async (model) => {
            const modelPath = await this.modelPath(model);
            const downloading = this.activeDownload?.modelId === model.id;
            return {
                modelId: model.id,
                name: model.name,
                sizeLabel: model.sizeLabel,
                ready: await this.fileSize(modelPath) === model.bytes,
                phase: downloading ? this.phase : 'idle',
                downloaded: downloading ? this.downloaded : await this.fileSize(`${modelPath}.part`),
                total: model.bytes,
                modelPath,
                downloadUrl: model.url,
                error: this.modelErrors.get(model.id) ?? null,
            };
        }));
        return {
            runtimeReady: await this.fileSize(this.runtimePath()) > 0
                && await this.runtimeDependencyReady(),
            running: this.child !== null,
            activeModelId: await this.getActiveModelId(),
            models,
        };
    }

    public async getActiveModelId(): Promise<string> {
        const modelId = this.settingsStore.get('models.local.active');
        return requireLocalAiModel(modelId).id;
    }

    public async setActiveModelId(modelId: string): Promise<void> {
        const model = requireLocalAiModel(modelId);
        const modelPath = await this.modelPath(model);
        if (await this.fileSize(modelPath) !== model.bytes) {
            throw new Error(`模型未下载完成，无法设为使用中：${model.name}`);
        }
        if (!this.settingsStore.set('models.local.active', model.id)) {
            throw new Error(`保存本地模型选择失败：${model.name}`);
        }
    }

    /** 启动指定模型的下载并保留唯一任务；错误保存在状态中，切页后仍可查看。 */
    public async download(modelId: string): Promise<void> {
        this.lifetime.signal.throwIfAborted();
        const model = requireLocalAiModel(modelId);
        if (this.activeDownload) throw new Error(`「${this.activeDownload.modelId}」正在下载，请等待完成后再下载其他模型`);
        if (this.busy > 0) throw new Error('本地模型正在使用，请稍后下载');
        this.phase = 'downloading';
        this.downloaded = 0;
        this.modelErrors.delete(modelId);
        const abort = new AbortController();
        this.emitProgress(modelId, true);
        const signal = AbortSignal.any([abort.signal, this.lifetime.signal]);
        const task = this.install(model, signal);
        this.activeDownload = { modelId, task, abort };
        try {
            await task;
        } catch (error) {
            if (!signal.aborted) {
                this.modelErrors.set(modelId, error instanceof Error ? error.message : String(error));
                this.logger.error('local model download failed', { model: modelId, error });
            }
            throw error;
        } finally {
            this.phase = 'idle';
            this.activeDownload = null;
            this.emitProgress(modelId, true);
        }
    }

    /** 下载固定版本，验证长度和 SHA256 后再原子重命名；损坏数据显式报错。 */
    private async install(model: LocalAiModelDefinition, signal: AbortSignal): Promise<void> {
        const modelPath = await this.modelPath(model);
        if (await this.fileSize(modelPath) === model.bytes) return;
        const partial = `${modelPath}.part`;
        await fs.promises.mkdir(path.dirname(modelPath), { recursive: true });
        const existing = await this.fileSize(partial);
        if (existing > model.bytes) throw new Error('未完成模型文件大小异常，请删除模型后重新下载');
        this.downloaded = existing;
        this.logger.info('local model download started', { model: model.id, downloaded: existing });
        if (existing < model.bytes) {
            const response = await axios.get(model.url, {
                responseType: 'stream', signal, timeout: 60_000,
                headers: existing > 0 ? { Range: `bytes=${existing}-` } : {},
            });
            const resumed = response.status === 206;
            if (resumed && response.headers['content-range'] !== `bytes ${existing}-${model.bytes - 1}/${model.bytes}`) {
                response.data.destroy();
                throw new Error('模型下载服务器返回了错误的续传范围');
            }
            if (!resumed) this.downloaded = 0;
            response.data.on('data', (chunk: Buffer) => {
                this.downloaded += chunk.length;
                this.emitProgress(model.id);
            });
            await pipeline(response.data, fs.createWriteStream(partial, { flags: resumed ? 'a' : 'w' }), { signal });
        }
        if (await this.fileSize(partial) !== model.bytes) throw new Error('模型下载不完整，请继续下载');
        this.phase = 'verifying';
        this.emitProgress(model.id, true);
        const hash = createHash('sha256');
        const stream = fs.createReadStream(partial, { signal });
        for await (const chunk of stream) hash.update(chunk);
        if (hash.digest('hex') !== model.sha256) throw new Error('模型 SHA256 校验失败，请删除模型后重新下载');
        signal.throwIfAborted();
        await fs.promises.rename(partial, modelPath);
        this.logger.info('local model installed', { model: model.id });
    }

    /** 等待取消完成后再允许重试，避免多个写入器同时操作续传文件。 */
    public async cancelDownload(): Promise<void> {
        const task = this.activeDownload?.task;
        if (!task) return;
        this.activeDownload?.abort.abort();
        await task.catch((error) => {
            if (!axios.isCancel(error) && error?.name !== 'AbortError') throw error;
        });
    }

    /** 删除指定模型的安装文件及续传数据；先释放已加载的模型。 */
    public async deleteModel(modelId: string): Promise<void> {
        const model = requireLocalAiModel(modelId);
        if (this.activeDownload?.modelId === modelId) throw new Error('模型正在下载，请先取消下载');
        if (this.busy > 0) throw new Error('本地模型正在使用，请稍后删除');
        if (modelId === await this.getActiveModelId()) throw new Error(`「${model.name}」是使用中的本地模型，请先在服务凭据页切换到其他模型`);
        this.busy++;
        try {
            await this.stop();
            const modelPath = await this.modelPath(model);
            await fs.promises.rm(modelPath, { force: true });
            await fs.promises.rm(`${modelPath}.part`, { force: true });
            this.modelErrors.delete(modelId);
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
    private async start(model: LocalAiModelDefinition, signal: AbortSignal): Promise<string> {
        const modelPath = await this.modelPath(model);
        if (this.endpoint && this.loadedPath === modelPath && this.child) return this.endpoint;
        await this.stop();
        if (await this.fileSize(modelPath) !== model.bytes) {
            throw new Error(`本地模型「${model.name}」未安装，请前往设置-服务凭据下载`);
        }
        const status = await this.getStatus();
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
        this.logger.info('local runtime started', { pid: child.pid, model: model.id });
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
    public async generate(prompt: string, schema: Record<string, unknown>, modelId: string, signal?: AbortSignal): Promise<unknown> {
        const model = requireLocalAiModel(modelId);
        if (this.activeDownload?.modelId === modelId) throw new Error(`本地模型「${model.name}」正在安装`);
        const combined = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(300_000), ...(signal ? [signal] : [])]);
        this.busy++;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        try {
            return await concurrency.withSemaphore('localAi', async () => {
                const endpoint = await this.start(model, combined);
                const startedAt = Date.now();
                try {
                    const response = await axios.post(`${endpoint}/v1/chat/completions`, {
                        model: model.id,
                        messages: [{ role: 'user', content: prompt }],
                        stream: false, temperature: 0.6, top_p: 0.95, top_k: 20,
                        max_tokens: 2048,
                        response_format: { type: 'json_object', schema },
                        chat_template_kwargs: { enable_thinking: false },
                    }, { proxy: false, signal: combined, timeout: 180_000, headers: { Authorization: `Bearer ${this.apiKey}` } });
                    const result = responseSchema.parse(response.data);
                    const parsed: unknown = JSON.parse(result.choices[0].message.content);
                    this.logger.info('local generation completed', { model: model.id, durationMs: Date.now() - startedAt });
                    return parsed;
                } catch (error) {
                    this.logger.error('local generation failed', { error, model: model.id, durationMs: Date.now() - startedAt });
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
