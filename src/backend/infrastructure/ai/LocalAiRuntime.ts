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
    CUSTOM_MODEL_ID_PREFIX,
    isCustomModelId,
    LOCAL_AI_DEFAULT_MODEL_ID,
    LOCAL_AI_MODELS,
    localAiGpuMode,
    LocalAiGpuMode,
    LocalAiModelDefinition,
    LocalAiSpeedTestResult,
    LocalAiStatus,
    requireLocalAiModel,
} from '@/common/contracts/local-ai';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';

/** 本地生成的 completion token 上限；与采样参数一同约束输出规模。 */
const MAX_COMPLETION_TOKENS = 2048;

const responseSchema = z.object({ choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ content: z.string() }),
})).length(1) });

/** 速度测试响应中 token 用量的宽松解析；推理端未返回用量时为 undefined。 */
const speedUsageSchema = z.object({
    usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
    }).optional(),
});

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

    /** 速度测试固定负载：5 句字幕批量翻译，与真实字幕批次同量级。 */
    private static readonly SPEED_TEST_PROMPT = [
        'Translate each subtitle line into Simplified Chinese.',
        'Respond with JSON only: {"items":[{"key":"<given key>","translation":"<simplified chinese>"}]}',
        '',
        '1: The weather turned colder as the sun went down.',
        '2: She packed the last box and looked around the empty apartment.',
        '3: The train arrives at platform nine in ten minutes.',
        '4: He promised to call as soon as the meeting ended.',
        '5: Nobody expected the storm to arrive so early in the season.',
    ].join('\n');

    /** 注入模型目录、设置存储和 renderer 通知边界。 */
    public constructor(
        @inject(TYPES.StorageDirectoryProvider) private readonly directories: StorageDirectoryProvider,
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
        @inject(TYPES.SettingsStore) private readonly settingsStore: SettingsStore,
    ) {}

    /** 解析模型在媒体库中的安装路径；目录模型在独立子目录，自定义模型直接位于模型根目录。 */
    private async modelPath(model: LocalAiModelDefinition): Promise<string> {
        const directory = await this.directories.provideDirectory(StorageDirectoryTarget.LOCAL_AI);
        return model.source === 'custom'
            ? path.join(directory, model.file)
            : path.join(directory, model.id, model.file);
    }

    /** 返回模型根目录的绝对路径，供设置页展示手动安装教程。 */
    private async modelsDirectory(): Promise<string> {
        return this.directories.provideDirectory(StorageDirectoryTarget.LOCAL_AI);
    }

    /** 估算模型运行内存占用；约为文件体积的 1.5 倍，覆盖权重 + KV cache + 推理缓冲。 */
    private memoryEstimateGb(bytes: number): string {
        return (bytes * 1.5 / 1024 / 1024 / 1024).toFixed(1);
    }

    /**
     * 将用户手动放入模型根目录的 GGUF 文件解析为自定义模型定义。
     *
     * 自定义 id 形如 `custom:<文件名>`；文件必须真实存在且非空，
     * 字节数以磁盘实际大小为准（无法做 SHA256 校验，由用户自行保证来源可靠）。
     */
    private async resolveCustomModel(modelId: string): Promise<LocalAiModelDefinition> {
        const file = modelId.slice(CUSTOM_MODEL_ID_PREFIX.length);
        if (!file || file.includes('/') || file.includes('\\') || file.includes('..')) {
            throw new Error(`非法的自定义模型标识：${modelId}`);
        }
        const directory = await this.modelsDirectory();
        const filePath = path.join(directory, file);
        const bytes = await this.fileSize(filePath);
        if (bytes <= 0) {
            throw new Error(`自定义模型文件不存在：${filePath}`);
        }
        return {
            id: modelId,
            name: file,
            file,
            bytes,
            sizeLabel: `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`,
            url: '',
            sha256: '',
            source: 'custom',
        };
    }

    /**
     * 解析任意模型 id 为完整定义；先查目录，再查自定义文件，都不存在时显式报错。
     */
    private async resolveModelDefinition(modelId: string): Promise<LocalAiModelDefinition> {
        if (isCustomModelId(modelId)) {
            return this.resolveCustomModel(modelId);
        }
        return requireLocalAiModel(modelId);
    }

    /** 扫描模型根目录下用户手动放入的 GGUF 文件（跳过隐藏文件与目录模型子目录）。 */
    private async scanCustomModels(): Promise<LocalAiModelDefinition[]> {
        const directory = await this.modelsDirectory();
        let entries: string[];
        try {
            entries = await fs.promises.readdir(directory);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw error;
        }
        const models = await Promise.all(entries
            .filter((entry) => entry.toLowerCase().endsWith('.gguf') && !entry.startsWith('.'))
            .map((file) => this.resolveCustomModel(`${CUSTOM_MODEL_ID_PREFIX}${file}`).catch(() => null)));
        return models.filter((model): model is LocalAiModelDefinition => model !== null);
    }

    /** 只使用明确支持的平台包；缺失的运行时由设置页显式展示。 */
    private runtimePath(): string {
        return getRuntimeResourcePath('lib', 'llama', 'b10819', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
    }

    /** 当前平台 llama.cpp 官方包的 GPU 后端模式；判定集中在 contracts，与下载脚本保持一一对应。 */
    private gpuMode(): LocalAiGpuMode {
        return localAiGpuMode();
    }

    /** GPU 加速是否生效：Metal 平台固定开启，Vulkan 平台读设置开关，CPU 平台固定关闭。 */
    private gpuEnabled(): boolean {
        const mode = this.gpuMode();
        if (mode === 'metal') return true;
        if (mode === 'cpu') return false;
        return this.settingsStore.get('models.local.gpu') === 'true';
    }

    /**
     * 运行时是否就绪：以安装脚本写入的 .complete 标记为准。
     *
     * 依赖库清单由 scripts/download.mjs 在安装时校验并写入标记，运行时侧不重复
     * 复刻清单，避免两份列表漂移后各自判定不一致。
     */
    private async runtimeMarkerReady(): Promise<boolean> {
        try {
            const entries = await fs.promises.readdir(path.dirname(this.runtimePath()));
            return entries.includes('.complete');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw error;
        }
    }

    /** 返回完整的运行时就绪判断：可执行文件存在且安装标记完整。 */
    private async runtimeReady(): Promise<boolean> {
        return await this.fileSize(this.runtimePath()) > 0 && await this.runtimeMarkerReady();
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
                file: model.file,
                bytes: model.bytes,
                sizeLabel: model.sizeLabel,
                memoryEstimateGb: this.memoryEstimateGb(model.bytes),
                ready: await this.fileSize(modelPath) === model.bytes,
                phase: downloading ? this.phase : 'idle',
                downloaded: downloading ? this.downloaded : await this.fileSize(`${modelPath}.part`),
                total: model.bytes,
                modelPath,
                downloadUrl: model.url,
                error: this.modelErrors.get(model.id) ?? null,
                custom: false,
            };
        }));
        const customModels = await Promise.all((await this.scanCustomModels()).map(async (model) => ({
            modelId: model.id,
            name: model.name,
            file: model.file,
            bytes: model.bytes,
            sizeLabel: model.sizeLabel,
            memoryEstimateGb: this.memoryEstimateGb(model.bytes),
            ready: true,
            phase: 'idle' as const,
            downloaded: model.bytes,
            total: model.bytes,
            modelPath: await this.modelPath(model),
            downloadUrl: null,
            error: null,
            custom: true,
        })));
        return {
            runtimeReady: await this.runtimeReady(),
            running: this.child !== null,
            activeModelId: await this.getActiveModelId(),
            modelsDirectory: await this.modelsDirectory(),
            models: [...models, ...customModels],
            gpuMode: this.gpuMode(),
            gpuEnabled: this.gpuEnabled(),
        };
    }

    public async getActiveModelId(): Promise<string> {
        const modelId = this.settingsStore.get('models.local.active');
        if (isCustomModelId(modelId)) {
            // 自定义模型文件被手动删除时显式报错，让用户重新选择，不做静默回退。
            await this.resolveCustomModel(modelId);
            return modelId;
        }
        if (LOCAL_AI_MODELS.some((model) => model.id === modelId)) {
            return modelId;
        }
        // 模型目录随版本演进可能移除旧条目；存储的使用中 id 失效时显式迁移到新默认值。
        // 这是一次性目录迁移，不是运行时兑底：只针对“id 已不在当前目录”这一种状态。
        this.logger.warn('stored local model id is no longer in catalog, reset to default', {
            stored: modelId,
            default: LOCAL_AI_DEFAULT_MODEL_ID,
        });
        if (!this.settingsStore.set('models.local.active', LOCAL_AI_DEFAULT_MODEL_ID)) {
            throw new Error(`本地模型目录已更新，重置使用中模型失败：${modelId}`);
        }
        return LOCAL_AI_DEFAULT_MODEL_ID;
    }

    public async setActiveModelId(modelId: string): Promise<void> {
        const model = await this.resolveModelDefinition(modelId);
        const modelPath = await this.modelPath(model);
        if (await this.fileSize(modelPath) !== model.bytes) {
            throw new Error(`模型未下载完成，无法设为使用中：${model.name}`);
        }
        if (!this.settingsStore.set('models.local.active', model.id)) {
            throw new Error(`保存本地模型选择失败：${model.name}`);
        }
    }

    /** 保存 Vulkan 平台的 GPU 加速开关；已加载的模型进程不受影响，下次加载时生效。 */
    public async setGpuEnabled(enabled: boolean): Promise<void> {
        if (this.gpuMode() !== 'vulkan') {
            throw new Error('当前平台不支持切换本地模型 GPU 加速');
        }
        this.settingsStore.set('models.local.gpu', enabled ? 'true' : 'false');
    }

    /** 启动指定模型的下载并保留唯一任务；错误保存在状态中，切页后仍可查看。 */
    public async download(modelId: string): Promise<void> {
        this.lifetime.signal.throwIfAborted();
        if (isCustomModelId(modelId)) {
            throw new Error('自定义模型由用户手动放置，不支持在线下载');
        }
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
        const model = await this.resolveModelDefinition(modelId);
        if (this.activeDownload?.modelId === modelId) throw new Error('模型正在下载，请先取消下载');
        // busy 计数必须在任何 await 之前递增，否则推理请求可能落在检查与递增之间。
        if (this.busy > 0) throw new Error('本地模型正在使用，请稍后删除');
        this.busy++;
        try {
            if (modelId === await this.getActiveModelId()) {
                throw new Error(`「${model.name}」是使用中的本地模型，请先在服务凭据页切换到其他模型`);
            }
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

    /** 判断加载轮询中捕获的错误是否属于“进程仍在启动”的可重试状态。 */
    private static isRuntimeWarmingUp(error: unknown): boolean {
        if (!axios.isAxiosError(error)) return false;
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') return true;
        return error.response?.status === 503;
    }

    /** 按需加载模型，使用随机鉴权密钥并等待就绪；加载失败会结束子进程。 */
    private async start(model: LocalAiModelDefinition, signal: AbortSignal): Promise<string> {
        const modelPath = await this.modelPath(model);
        if (this.endpoint && this.loadedPath === modelPath && this.child) return this.endpoint;
        await this.stop();
        if (await this.fileSize(modelPath) !== model.bytes) {
            throw new Error(`本地模型「${model.name}」未安装，请前往设置-服务凭据下载`);
        }
        if (!(await this.runtimeReady())) {
            throw new Error('llama.cpp 运行时缺失，请重新执行 yarn run download 或重新安装应用');
        }
        const port = await this.reservePort();
        signal.throwIfAborted();
        const endpoint = `http://127.0.0.1:${port}`;
        const gpuRequested = this.gpuEnabled();
        const child = spawn(this.runtimePath(), [
            '--model', modelPath, '--host', '127.0.0.1', '--port', String(port),
            '--ctx-size', '8192', '--parallel', '1', '--jinja', '--no-webui',
            '--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning-budget', '0',
            // Metal/Vulkan 平台把全部层放进 GPU；CPU 包传 0 保持纯 CPU 推理。
            '--n-gpu-layers', gpuRequested ? '99' : '0',
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
                    if (!LocalAiRuntime.isRuntimeWarmingUp(error)) throw error;
                }
                await delay(250, undefined, { signal: loadingSignal });
            }
        } catch (error) {
            this.logger.error('local runtime load failed', { error, stderrTail });
            await this.stop();
            throw this.enrichLoadFailure(error, gpuRequested, stderrTail);
        }
    }

    /**
     * 将加载失败包装为对用户可操作的错误信息。
     *
     * Vulkan 平台开启 GPU 时，机器缺 Vulkan 驱动或显卡不支持会导致 llama-server 启动即退出，
     * 此时应补充关闭 GPU 开关的指引，并附带推理进程最后几行输出方便定位；
     * 其它场景维持原错误信息不变。
     */
    private enrichLoadFailure(error: unknown, gpuRequested: boolean, stderrTail: string[]): Error {
        const base = error instanceof Error ? error.message : String(error);
        if (!(gpuRequested && this.gpuMode() === 'vulkan')) {
            return error instanceof Error ? error : new Error(base);
        }
        const detail = stderrTail.map((line) => line.trim()).filter(Boolean).slice(-3).join(' ｜ ').slice(0, 300);
        const hint = '本地模型 GPU 加速已开启：若显卡或驱动不支持 Vulkan，请在设置-服务凭据中关闭 GPU 加速后重试';
        return new Error(detail ? `${base}（${hint}）进程输出：${detail}` : `${base}（${hint}）`);
    }

    /**
     * 串行生成，限制上下文和输出长度；仅接受完整结束且可解析的 JSON。
     */
    public async generate(prompt: string, schema: Record<string, unknown>, modelId: string, signal?: AbortSignal): Promise<unknown> {
        const model = await this.resolveModelDefinition(modelId);
        if (this.activeDownload?.modelId === modelId) throw new Error(`本地模型「${model.name}」正在安装`);
        const combined = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(300_000), ...(signal ? [signal] : [])]);
        return this.runSerial(async () => {
            const endpoint = await this.start(model, combined);
            const startedAt = Date.now();
            try {
                const result = responseSchema.parse(await this.postChat(endpoint, this.buildChatBody(model.id, prompt, schema), combined));
                const finishReason = result.choices[0].finish_reason;
                if (finishReason !== 'stop') {
                    // length：输出顶到 max_tokens 上限被截断，JSON 必然不完整；
                    // 其余原因原样透出，避免 zod 天书直接冒给用户。
                    throw new Error(finishReason === 'length'
                        ? `本地模型输出超过单次 ${MAX_COMPLETION_TOKENS} token 上限被截断（多为模型输出循环），请重试`
                        : `本地模型输出未正常结束（finish_reason=${finishReason}）`);
                }
                let parsed: unknown;
                try {
                    parsed = JSON.parse(result.choices[0].message.content);
                } catch (error) {
                    throw new Error(`本地模型返回的 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`);
                }
                this.logger.info('local generation completed', { model: model.id, durationMs: Date.now() - startedAt });
                return parsed;
            } catch (error) {
                this.logger.error('local generation failed', { error, model: model.id, durationMs: Date.now() - startedAt });
                await this.stop();
                throw error;
            }
        }, combined);
    }

    /**
     * 对指定模型执行速度测试：先释放已加载模型再冷加载，两轮固定批量生成。
     *
     * 负载为 5 句字幕翻译，与真实字幕批次同量级；首轮包含推理初始化
     * （如 Vulkan shader 编译），热身轮反映稳定吞吐。
     * 采样参数与 generate 完全一致，测得的速度即真实翻译速度。
     *
     * @param modelId 待测速的本地模型标识。
     * @returns 冷加载、首轮、热身耗时与 token 用量、生成速度。
     */
    public async speedTest(modelId: string): Promise<LocalAiSpeedTestResult> {
        if (this.activeDownload) throw new Error('本地模型正在下载，请等待完成后再测速');
        // 占用计数在任何 await 之前递增，避免与推理/删除请求落在检查与递增之间。
        if (this.busy > 0) throw new Error('本地模型正在使用，请稍后重试');
        this.busy++;
        try {
            const model = await this.resolveModelDefinition(modelId);
            const combined = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(300_000)]);
            if (this.idleTimer) clearTimeout(this.idleTimer);
            return await concurrency.withSemaphore('localAi', async () => {
                // 先释放已加载模型，确保测到真实的冷加载成本。
                await this.stop();
                const loadStartedAt = Date.now();
                const endpoint = await this.start(model, combined);
                const loadMs = Date.now() - loadStartedAt;
                const schema = z.object({ items: z.array(z.object({ key: z.string(), translation: z.string() })) });
                const body = this.buildChatBody(model.id, LocalAiRuntime.SPEED_TEST_PROMPT, z.toJSONSchema(schema));
                try {
                    const firstStartedAt = Date.now();
                    const first = await this.postChat(endpoint, body, combined);
                    const firstMs = Date.now() - firstStartedAt;
                    const warmStartedAt = Date.now();
                    const warm = await this.postChat(endpoint, body, combined);
                    const warmMs = Date.now() - warmStartedAt;
                    const firstUsage = speedUsageSchema.parse(first).usage;
                    const warmUsage = speedUsageSchema.parse(warm).usage;
                    const result: LocalAiSpeedTestResult = {
                        loadMs,
                        firstMs,
                        warmMs,
                        promptTokens: warmUsage?.prompt_tokens ?? null,
                        completionTokens: warmUsage?.completion_tokens ?? null,
                        tokensPerSecond: warmUsage ? Number((warmUsage.completion_tokens / (warmMs / 1000)).toFixed(1)) : null,
                    };
                    // 键名避开 "token" 子串：日志脱敏规则会把含 token 的键整体打码。
                    const usageForLog = (usage: { prompt_tokens: number; completion_tokens: number } | undefined, durationMs: number) => usage
                        ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, perSecond: Number((usage.completion_tokens / (durationMs / 1000)).toFixed(1)) }
                        : null;
                    this.logger.info('local speed test completed', {
                        model: model.id,
                        loadMs,
                        firstMs,
                        warmMs,
                        usage: {
                            first: usageForLog(firstUsage, firstMs),
                            warm: usageForLog(warmUsage, warmMs),
                        },
                    });
                    return result;
                } catch (error) {
                    this.logger.error('local speed test failed', { error, model: model.id });
                    await this.stop();
                    throw error;
                }
            }, { signal: combined });
        } finally {
            this.busy--;
            this.settleBusy();
        }
    }

    /** 归零占用计数后重新武装空闲卸载计时器。 */
    private settleBusy(): void {
        if (this.busy === 0 && !this.lifetime.signal.aborted) {
            this.idleTimer = setTimeout(() => { void this.stop().catch((error) => this.logger.error('local runtime stop failed', { error })); }, 300_000);
            this.idleTimer.unref();
        }
    }

    /** 在本地推理互斥信号量内执行；占用期间暂停空闲卸载，结束后重新计时。 */
    private async runSerial<T>(fn: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
        this.busy++;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        try {
            return await concurrency.withSemaphore('localAi', () => fn(signal), { signal });
        } finally {
            this.busy--;
            this.settleBusy();
        }
    }

    /** 组装与推理参数固定一致的 chat 请求体；本地链路所有生成共用同一采样参数。 */
    private buildChatBody(modelId: string, prompt: string, schema: Record<string, unknown>): Record<string, unknown> {
        return {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            stream: false, temperature: 0.6, top_p: 0.95, top_k: 20,
            max_tokens: MAX_COMPLETION_TOKENS,
            response_format: { type: 'json_object', schema },
            chat_template_kwargs: { enable_thinking: false },
        };
    }

    /** 发送一次 chat 请求并返回原始响应体；鉴权、代理禁用与超时在此统一处理。 */
    private async postChat(endpoint: string, body: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
        return (await axios.post(`${endpoint}/v1/chat/completions`, body, {
            proxy: false, signal, timeout: 180_000,
            headers: { Authorization: `Bearer ${this.apiKey}` },
        })).data;
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
