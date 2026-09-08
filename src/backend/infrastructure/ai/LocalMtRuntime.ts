import { inject, injectable } from 'inversify';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import axios from 'axios';
import { pipeline, env } from '@huggingface/transformers';
import type { TranslationOutput } from '@huggingface/transformers';
import TYPES from '@/backend/ioc/types';
import StorageDirectoryProvider, { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { concurrency } from '@/backend/utils/concurrency';
import { getMainLogger } from '@/backend/infrastructure/logger';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import type LocalMtService from '@/backend/services/LocalMtService';
import {
    LOCAL_MT_MODEL_FILES,
    LOCAL_MT_MODEL_ID,
    LOCAL_MT_TOTAL_BYTES,
    LocalMtStatus,
} from '@/common/contracts/local-mt';

/** transformers.js 翻译 pipeline 的实例类型。 */
type MtPipeline = Awaited<ReturnType<typeof pipeline<'translation'>>>;

/**
 * 管理轻量翻译模型（OPUS-MT en→zh，ONNX）的安装与推理。
 *
 * 与 LocalAiRuntime 不同，推理经 transformers.js 直接跑在本进程内
 * （onnxruntime-node），无子进程、无空闲卸载需求：会话懒加载后常驻，
 * 内存占用约等于模型体积。同一时间只允许一个下载任务；推理经 localMt
 * 信号量串行，与安装/删除互斥。
 */
@injectable()
export class LocalMtRuntime implements LocalMtService {
    private readonly logger = getMainLogger('LocalMtRuntime');
    /** 懒加载的翻译 pipeline；加载失败后置空，下次调用重试。 */
    private pipelinePromise: Promise<MtPipeline> | null = null;
    private activeDownload: { task: Promise<void>; abort: AbortController } | null = null;
    private busy = 0;
    private phase: LocalMtStatus['phase'] = 'idle';
    private downloaded = 0;
    private lastProgressAt = 0;
    /** 最近一次下载失败原因；成功后清除，切页后仍可查看。 */
    private downloadError: string | null = null;

    /** 注入模型目录与 renderer 通知边界。 */
    public constructor(
        @inject(TYPES.StorageDirectoryProvider) private readonly directories: StorageDirectoryProvider,
        @inject(TYPES.RendererGateway) private readonly rendererGateway: RendererGateway,
    ) {}

    /** 模型安装目录：本地 AI 资源目录下的 mt/<模型 id>。 */
    private async modelPath(): Promise<string> {
        const directory = await this.directories.provideDirectory(StorageDirectoryTarget.LOCAL_AI);
        return path.join(directory, 'mt', LOCAL_MT_MODEL_ID);
    }

    /** 推送节流后的下载快照；阶段变化和终态始终立即发出。 */
    private emitProgress(force = false): void {
        const now = Date.now();
        if (!force && now - this.lastProgressAt < 100) return;
        this.lastProgressAt = now;
        this.rendererGateway.fireAndForget('settings/local-mt-download-progress', {
            phase: this.phase,
            downloaded: this.downloaded,
            total: LOCAL_MT_TOTAL_BYTES,
        });
    }

    /** 返回单个文件的完整安装路径。 */
    private filePathFor(modelPath: string, relativePath: string): string {
        return path.join(modelPath, relativePath);
    }

    /** 查询文件大小；不存在返回 0，其余错误显式抛出。 */
    private async fileSize(file: string): Promise<number> {
        try {
            const stat = await fs.promises.stat(file);
            return stat.isFile() ? stat.size : 0;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
            throw error;
        }
    }

    /**
     * 校验安装完整性：全部文件字节数匹配且存在 .complete 标记。
     *
     * .complete 由安装流程在逐文件 SHA256 校验通过后写入；缺失或大小不符
     * 都视为未安装，由用户重新下载。
     */
    private async isReady(modelPath: string): Promise<boolean> {
        try {
            await fs.promises.access(path.join(modelPath, '.complete'));
        } catch {
            return false;
        }
        for (const file of LOCAL_MT_MODEL_FILES) {
            if (await this.fileSize(this.filePathFor(modelPath, file.path)) !== file.bytes) {
                return false;
            }
        }
        return true;
    }

    /** 下载已就绪字节数：完整文件计全量，续传文件计已有部分。 */
    private async settledBytes(modelPath: string): Promise<number> {
        let total = 0;
        for (const file of LOCAL_MT_MODEL_FILES) {
            const finalPath = this.filePathFor(modelPath, file.path);
            const partialPath = `${finalPath}.part`;
            const finalSize = await this.fileSize(finalPath);
            total += finalSize === file.bytes ? finalSize : await this.fileSize(partialPath);
        }
        return total;
    }

    public async getStatus(): Promise<LocalMtStatus> {
        const modelPath = await this.modelPath();
        const downloading = this.activeDownload !== null;
        return {
            ready: await this.isReady(modelPath),
            phase: downloading ? this.phase : 'idle',
            downloaded: downloading ? this.downloaded : await this.settledBytes(modelPath),
            total: LOCAL_MT_TOTAL_BYTES,
            modelPath,
            error: this.downloadError,
        };
    }

    /** 启动唯一模型的下载；进行中的下载或推理会拒绝新任务。 */
    public async download(): Promise<void> {
        if (this.activeDownload) throw new Error('轻量翻译模型正在下载，请等待完成');
        if (this.busy > 0) throw new Error('轻量翻译模型正在使用，请稍后下载');
        this.phase = 'downloading';
        this.downloadError = null;
        this.downloaded = 0;
        const abort = new AbortController();
        this.emitProgress(true);
        const signal = abort.signal;
        const task = this.install(signal);
        this.activeDownload = { task, abort };
        try {
            await task;
        } catch (error) {
            if (!signal.aborted) {
                this.downloadError = error instanceof Error ? error.message : String(error);
                this.logger.error('local mt model download failed', { error });
            }
            throw error;
        } finally {
            this.phase = 'idle';
            this.activeDownload = null;
            this.emitProgress(true);
        }
    }

    /**
     * 逐文件下载、SHA256 校验并原子重命名；全部文件就绪后写入 .complete。
     *
     * 已完整的文件跳过；未完成的续传（Range 请求），与 LocalAiRuntime 的
     * 安装策略一致：损坏数据显式报错，不做静默重下。
     * TODO: 与 LocalAiRuntime 的安装段是同一「可续传文件安装」不变量的两份
     * 实现，应提取共享的 resumable installer 基建，两处只声明文件清单。
     */
    private async install(signal: AbortSignal): Promise<void> {
        const modelPath = await this.modelPath();
        await fs.promises.mkdir(modelPath, { recursive: true });
        this.downloaded = await this.settledBytes(modelPath);
        this.logger.info('local mt model download started', { downloaded: this.downloaded });

        for (const file of LOCAL_MT_MODEL_FILES) {
            const finalPath = this.filePathFor(modelPath, file.path);
            if (await this.fileSize(finalPath) === file.bytes) continue;
            const partialPath = `${finalPath}.part`;
            await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });
            const existing = await this.fileSize(partialPath);
            if (existing > file.bytes) {
                throw new Error(`未完成文件大小异常，请删除模型后重新下载：${file.path}`);
            }
            const response = await axios.get(file.url, {
                // Node adapter 下 timeout 是 socket 空闲超时而非总时长，慢速连接不会误断。
                responseType: 'stream', signal, timeout: 60_000,
                headers: existing > 0 ? { Range: `bytes=${existing}-` } : {},
            });
            const resumed = response.status === 206;
            if (resumed && response.headers['content-range'] !== `bytes ${existing}-${file.bytes - 1}/${file.bytes}`) {
                response.data.destroy();
                throw new Error(`模型下载服务器返回了错误的续传范围：${file.path}`);
            }
            if (!resumed) this.downloaded -= existing;
            response.data.on('data', (chunk: Buffer) => {
                this.downloaded += chunk.length;
                this.emitProgress();
            });
            const { pipeline: streamPipeline } = await import('node:stream/promises');
            await streamPipeline(response.data, fs.createWriteStream(partialPath, { flags: resumed ? 'a' : 'w' }), { signal });

            if (await this.fileSize(partialPath) !== file.bytes) {
                throw new Error(`模型文件下载不完整，请继续下载：${file.path}`);
            }
            this.phase = 'verifying';
            this.emitProgress(true);
            const hash = createHash('sha256');
            const stream = fs.createReadStream(partialPath, { signal });
            for await (const chunk of stream) hash.update(chunk);
            if (hash.digest('hex') !== file.sha256) {
                // 损坏的 .part 续传永远过不了校验，顺手删除让「重新下载」一步到位。
                await fs.promises.rm(partialPath, { force: true });
                throw new Error(`模型文件 SHA256 校验失败，请删除模型后重新下载：${file.path}`);
            }
            this.phase = 'downloading';
            signal.throwIfAborted();
            await fs.promises.rename(partialPath, finalPath);
        }
        await fs.promises.writeFile(path.join(modelPath, '.complete'), `${LOCAL_MT_MODEL_ID}\n`);
        this.logger.info('local mt model installed', { model: LOCAL_MT_MODEL_ID });
    }

    public async cancelDownload(): Promise<void> {
        const task = this.activeDownload?.task;
        if (!task) return;
        this.activeDownload?.abort.abort();
        await task.catch((error) => {
            if (!axios.isCancel(error) && error?.name !== 'AbortError') throw error;
        });
    }

    /** 删除模型目录；先取消下载，推理进行中时拒绝。 */
    public async deleteModel(): Promise<void> {
        if (this.activeDownload) throw new Error('模型正在下载，请先取消下载');
        if (this.busy > 0) throw new Error('轻量翻译模型正在使用，请稍后删除');
        this.busy++;
        try {
            await this.cancelDownload();
            // 等待在途推理结束后再删；新推理因目录缺失而显式报错。
            await concurrency.withSemaphore('localMt', async () => {
                this.pipelinePromise = null;
                const modelPath = await this.modelPath();
                await fs.promises.rm(modelPath, { force: true, recursive: true });
                this.downloadError = null;
            });
        } finally { this.busy--; }
    }

    /**
     * 懒加载翻译 pipeline；transformers.js 经动态 import 引入，
     * 未启用该引擎时不为应用启动增加 onnxruntime 负担。
     * 加载本身不可取消（onnx 会话构建无中断点）；调用方在加载前后自行检查取消。
     */
    private async ensurePipeline(): Promise<MtPipeline> {
        if (this.pipelinePromise) return this.pipelinePromise;
        const loadTask = (async () => {
            const modelPath = await this.modelPath();
            if (!(await this.isReady(modelPath))) {
                throw new Error('轻量翻译模型未安装，请前往设置-服务凭据下载');
            }
            const startedAt = Date.now();
            // 进程级全局突变：目前仓库唯一的 transformers.js 使用点；若出现第二个
            // 使用者，这两行会静默影响它，届时应改为每次调用前设置或封装。
            env.allowLocalModels = true;
            env.allowRemoteModels = false;
            const loaded = await pipeline('translation', modelPath, {
                dtype: { encoder_model: 'q8', decoder_model_merged: 'fp32' },
            });
            this.logger.info('local mt pipeline loaded', { durationMs: Date.now() - startedAt });
            return loaded;
        })();
        this.pipelinePromise = loadTask;
        try {
            return await loadTask;
        } catch (error) {
            this.pipelinePromise = null;
            throw error;
        }
    }

    /**
     * 批量翻译：整批占 localMt 信号量串行，批内逐句并发提交
     * （onnxruntime 会话支持并发 run）。取消语义是「停止新工作、在途跑完」：
     * 信号只在批次边界检查，已提交给 onnx 会话的推理不可中断，会完整结束。
     */
    public async translateLines(texts: string[], signal?: AbortSignal): Promise<string[]> {
        // 批次级超时兜底：单批 5 句正常远低于该上限，超时说明会话异常。
        const combined = AbortSignal.any([AbortSignal.timeout(120_000), ...(signal ? [signal] : [])]);
        return this.runExclusive(async () => {
            combined.throwIfAborted();
            const translator = await this.ensurePipeline();
            combined.throwIfAborted();
            const startedAt = Date.now();
            const outputs = await Promise.all(texts.map((text) => translator(text))) as TranslationOutput[];
            this.logger.info('local mt batch translated', {
                count: texts.length,
                durationMs: Date.now() - startedAt,
            });
            combined.throwIfAborted();
            return outputs.map((output) => output[0].translation_text.trim());
        });
    }

    /** 在 localMt 信号量内执行；占用计数同时拦截删除任务。 */
    private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        this.busy++;
        try {
            return await concurrency.withSemaphore('localMt', fn);
        } finally {
            this.busy--;
        }
    }
}
