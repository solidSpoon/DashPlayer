import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import CacheService from '@/backend/services/CacheService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import SettingService from '@/backend/services/SettingService';
import OpenAiSubtitleTranslationGateway, {
    OpenAiSubtitleTranslationResultItem,
    OpenAiSubtitleTranslationTarget,
} from '@/backend/services/gateways/translate/OpenAiSubtitleTranslationGateway';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import { TencentTranslateClient } from '@/backend/services/gateways/translate/TencentTranslateClient';
import SentenceTranslatesRepository from '@/backend/services/repositories/SentenceTranslatesRepository';
import SubtitleTranslationScheduler, {
    SubtitleTranslationBatchRequest,
    SubtitleTranslationBatchResult,
} from '@/backend/services/subtitle-translation/SubtitleTranslationScheduler';
import { concurrency } from '@/backend/utils/concurrency';
import {
    buildSubtitleBatchPrompt,
    resolveSubtitleStyleWithSignature,
} from '@/common/constants/openaiSubtitlePrompts';
import { Sentence } from '@/common/types/SentenceC';
import {
    RendererTranslationItem,
    TranslationMode,
    TranslationProvider,
} from '@/common/types/TranslationResult';
import TimeUtil from '@/common/utils/TimeUtil';
import { p } from '@/common/utils/Util';

type SubtitleTranslationStorageMode = 'tencent' | `openai_${string}`;

/**
 * 单个字幕翻译会话使用的稳定配置。
 */
interface SubtitleTranslationExecutionContext {
    /** 当前翻译 provider。 */
    provider: TranslationProvider;
    /** 当前持久化缓存模式。 */
    storageMode: SubtitleTranslationStorageMode;
    /** 前端用于过滤过期结果的翻译模式。 */
    mode: TranslationMode;
    /**
     * 当前字幕文件按稳定坐标（sentence.index）索引的句子映射。
     * 增量转录会话的坐标为「分片序号 × 100000 + 片内序号」，与数组下标不同，
     * 因此取句、前后文邻居查询都必须走该映射而非数组下标。
     */
    sentencesByIndex: Map<number, Sentence>;
    /** 当前字幕文件哈希。 */
    fileHash: string;
    /** 为 true 时翻译结果仅存内存，不写入数据库（增量转录会话）。 */
    transient?: boolean;
    /** OpenAI 批量提示词使用的风格约束。 */
    style?: string;
}

/**
 * 不依赖播放窗口的独立字幕翻译目标。
 */
interface DirectTranslationTarget {
    /** 用于缓存和结果映射的归一化原文键。 */
    key: string;
    /** 保留原始大小写的待翻译文本。 */
    text: string;
}

/**
 * 后端接收的当前字幕翻译需求。
 */
export interface SubtitleTranslationDemandInput {
    /** 字幕文件哈希。 */
    fileHash: string;
    /** 当前正在播放的字幕稳定坐标（sentence.index；增量转录为大坐标）。 */
    currentIndex: number;
    /** 前端按播放位置递增的需求标记。 */
    demandId: number;
    /** 发起需求的 renderer 进程会话标识。 */
    rendererSessionId: string;
}

/**
 * 管理当前字幕翻译需求与内存会话。
 */
export default interface SubtitleTranslationService {
    /**
     * 使用当前字幕翻译配置直接翻译一组文本。
     *
     * @param texts 待翻译文本；重复项会按忽略大小写的文本键合并。
     * @returns 归一化原文到翻译结果的映射。
     */
    translateTexts(texts: string[]): Promise<Map<string, string>>;

    /**
     * 更新当前播放位置；方法只负责提交需求，不等待远端翻译完成。
     *
     * @param input 当前字幕文件与播放索引。
     */
    updateDemand(input: SubtitleTranslationDemandInput): Promise<void>;

    /**
     * 释放指定字幕文件的内存会话并取消过期请求。
     *
     * @param fileHash 字幕文件哈希。
     * @param rendererSessionId 当前 renderer 进程的会话标识。
     */
    releaseSession(fileHash: string, rendererSessionId: string): void;
}

/**
 * 将 OpenAI 字幕模式映射为带风格签名的持久化模式。
 *
 * @param mode 当前 OpenAI 字幕模式。
 * @param signature 当前风格签名。
 * @returns 用于按配置隔离缓存的持久化模式。
 */
const mapOpenAiModeToStorage = (
    mode: TranslationMode,
    signature: string
): SubtitleTranslationStorageMode => {
    const suffix = `#${signature}`;
    if (mode === 'simple_en') {
        return `openai_simple_en${suffix}`;
    }
    if (mode === 'custom') {
        return `openai_custom${suffix}`;
    }
    return `openai_zh${suffix}`;
};

/**
 * 判断字幕文本是否包含值得送往翻译服务的文字或数字。
 *
 * @param text 字幕原文。
 * @returns 包含文字或数字时返回 true。
 */
const shouldTranslateSubtitleText = (text: string): boolean =>
    text.trim().length > 0 && /[\p{L}\p{N}]/u.test(text);

/**
 * 将未知异常转换为适合提示用户的短消息。
 *
 * @param error 原始异常。
 * @returns 可展示的错误消息；无法提取时返回 undefined。
 */
const errorToBriefMessage = (error: unknown): string | undefined => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }
    if (typeof error === 'string' && error.trim().length > 0) {
        return error.trim();
    }
    return undefined;
};

/**
 * 截断过长的错误文本，避免弹窗被第三方响应占满。
 *
 * @param value 原始文本。
 * @param maxLength 最大字符数。
 * @returns 截断后的文本。
 */
const truncate = (value: string, maxLength: number): string =>
    value.length <= maxLength
        ? value
        : `${value.slice(0, Math.max(0, maxLength - 1))}…`;

/**
 * 创建结构化字幕结果校验失败时使用的稳定异常。
 *
 * @param message 校验失败原因。
 * @returns 可被业务重试分类识别的异常。
 */
const createSubtitleValidationError = (message: string): Error => {
    const error = new Error(message);
    error.name = 'SubtitleTranslationValidationError';
    return error;
};

/**
 * 创建标准主动取消异常。
 *
 * @returns 名称稳定的主动取消异常。
 */
const createAbortError = (): Error => {
    const error = new Error('This operation was aborted');
    error.name = 'AbortError';
    return error;
};

/**
 * 负责字幕缓存查询、在线翻译、结果持久化与窗口调度。
 */
@injectable()
export class SubtitleTranslationServiceImpl implements SubtitleTranslationService {
    private readonly logger = getMainLogger('SubtitleTranslationServiceImpl');

    @inject(TYPES.SettingService)
    private settingService!: SettingService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.ModelRoutingService)
    private modelRoutingService!: ModelRoutingService;

    @inject(TYPES.SentenceTranslatesRepository)
    private sentenceTranslatesRepository!: SentenceTranslatesRepository;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.TencentClientProvider)
    private tencentProvider!: ClientProviderService<TencentTranslateClient>;

    @inject(TYPES.OpenAiSubtitleTranslationGateway)
    private openAiGateway!: OpenAiSubtitleTranslationGateway;

    /** 按字幕文件维护事件驱动的优先级翻译窗口。 */
    private readonly scheduler =
        new SubtitleTranslationScheduler<SubtitleTranslationExecutionContext>({
            executeBatch: (request) => this.executeBatch(request),
            onBatchError: (error, request) => {
                this.logger.error('字幕翻译调度执行器异常', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                    error,
                });
            },
            onBatchRequeued: (request) => {
                this.logger.warn('字幕翻译批次重新入队', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    provider: request.context.provider,
                    mode: request.context.mode,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                });
            },
            onBatchDeadLetter: (request) => {
                this.logger.error('字幕翻译批次进入死信状态', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    provider: request.context.provider,
                    mode: request.context.mode,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                });
            },
            onBatchDropped: (request) => {
                this.logger.info('字幕翻译失败批次已离开播放窗口', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    provider: request.context.provider,
                    mode: request.context.mode,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                });
            },
        });

    /**
     * 使用当前 provider 对独立文本批次执行一次结构化翻译。
     *
     * 该入口供收藏片段等非播放窗口场景使用，与播放调度共用缓存、Provider
     * 网关、批量 Prompt 和结果校验，但不会创建播放位置会话。
     *
     * @param texts 待翻译文本；空白项会被忽略，重复项按归一化文本键合并。
     * @returns 归一化原文到翻译结果的映射。
     */
    public async translateTexts(texts: string[]): Promise<Map<string, string>> {
        const targetsByKey = new Map<string, DirectTranslationTarget>();
        texts.forEach((text) => {
            const trimmed = text.trim();
            const key = p(trimmed);
            if (key && !targetsByKey.has(key)) {
                targetsByKey.set(key, { key, text: trimmed });
            }
        });
        if (targetsByKey.size === 0) {
            return new Map();
        }

        const provider = await this.settingService.getCurrentTranslationProvider();
        if (!provider) {
            throw new Error('未启用字幕翻译服务');
        }

        let mode: TranslationMode = 'zh';
        let storageMode: SubtitleTranslationStorageMode = 'tencent';
        let style: string | undefined;
        if (provider === 'openai') {
            mode = await this.settingService.getOpenAiSubtitleTranslationMode();
            const customStyle = mode === 'custom'
                ? await this.settingService.getOpenAiSubtitleCustomStyle()
                : undefined;
            const resolved = resolveSubtitleStyleWithSignature(mode, customStyle);
            style = resolved.style;
            storageMode = mapOpenAiModeToStorage(mode, resolved.signature);
            if (!this.modelRoutingService.resolveOpenAiModel('subtitleTranslation')) {
                throw new Error('OpenAI 字幕翻译模型未配置');
            }
        }

        const targets = Array.from(targetsByKey.values());
        const cached = await this.getTranslations(
            targets.map((target) => target.key),
            storageMode
        );
        const result = new Map(cached);
        const freshResults = new Map<string, string>();
        const pending = targets.filter((target) => !cached.has(target.key));
        const skipped = pending.filter((target) => !shouldTranslateSubtitleText(target.text));
        skipped.forEach((target) => {
            result.set(target.key, target.text);
            freshResults.set(target.key, target.text);
        });

        const onlineTargets = pending.filter(
            (target) => shouldTranslateSubtitleText(target.text)
        );
        if (onlineTargets.length > 0) {
            const batchId = `direct-${Date.now()}`;
            const startedAt = Date.now();
            const onlineResults = provider === 'tencent'
                ? await this.translateDirectWithTencent(onlineTargets, batchId)
                : await this.translateDirectWithOpenAi(onlineTargets, mode, style);
            onlineResults.forEach((translation, key) => {
                result.set(key, translation);
                freshResults.set(key, translation);
            });
            this.logger.info('独立字幕批次翻译完成', {
                batchId,
                provider,
                mode,
                targetCount: onlineTargets.length,
                elapsedMs: Date.now() - startedAt,
            });
        }

        await this.saveTranslations(freshResults, storageMode);
        return result;
    }

    /**
     * 解析当前设置并提交字幕翻译需求。
     *
     * @param input 当前字幕文件与播放索引。
     */
    public async updateDemand(input: SubtitleTranslationDemandInput): Promise<void> {
        const fileHash = input.fileHash.trim();
        if (!fileHash) {
            throw new Error('字幕文件哈希不能为空');
        }
        if (!Number.isInteger(input.currentIndex) || input.currentIndex < 0) {
            throw new Error(`字幕索引无效: ${input.currentIndex}`);
        }
        if (!Number.isInteger(input.demandId) || input.demandId < 1) {
            throw new Error(`字幕需求标记无效: ${input.demandId}`);
        }
        if (!input.rendererSessionId.trim()) {
            throw new Error('renderer 会话标识不能为空');
        }

        const srtData = this.cacheService.get('cache:srt', fileHash);
        if (!srtData) {
            this.scheduler.release(fileHash, input.rendererSessionId);
            throw new Error('未找到字幕缓存，请重新加载字幕或重新打开视频');
        }
        // 坐标升序排列；普通 SRT 的坐标即 0..N-1，与数组下标一致。
        const sentenceIndices = srtData.sentences
            .map((sentence) => sentence.index)
            .sort((left, right) => left - right);

        const provider = await this.settingService.getCurrentTranslationProvider();
        if (!provider) {
            this.scheduler.release(fileHash, input.rendererSessionId);
            throw new Error('未启用字幕翻译服务');
        }

        if (provider === 'tencent') {
            this.scheduler.updateDemand({
                fileHash,
                currentIndex: input.currentIndex,
                demandId: input.demandId,
                rendererSessionId: input.rendererSessionId,
                sentenceIndices,
                profileKey: 'tencent',
                context: {
                    provider,
                    storageMode: 'tencent',
                    mode: 'zh',
                    sentencesByIndex: this.buildSentencesByIndex(srtData.sentences),
                    fileHash,
                    transient: srtData.transient ?? false,
                },
            });
            return;
        }

        const mode = await this.settingService.getOpenAiSubtitleTranslationMode();
        const customStyle = mode === 'custom'
            ? await this.settingService.getOpenAiSubtitleCustomStyle()
            : undefined;
        const { style, signature } = resolveSubtitleStyleWithSignature(mode, customStyle);
        const routedModel = this.modelRoutingService.resolveOpenAiModel('subtitleTranslation');
        if (!routedModel) {
            this.scheduler.release(fileHash, input.rendererSessionId);
            throw new Error('OpenAI 字幕翻译模型未配置');
        }

        const storageMode = mapOpenAiModeToStorage(mode, signature);
        this.scheduler.updateDemand({
            fileHash,
            currentIndex: input.currentIndex,
            demandId: input.demandId,
            rendererSessionId: input.rendererSessionId,
            sentenceIndices,
            profileKey: `${storageMode}:${routedModel.fullModelId}`,
            context: {
                provider,
                storageMode,
                mode,
                sentencesByIndex: this.buildSentencesByIndex(srtData.sentences),
                fileHash,
                transient: srtData.transient ?? false,
                style,
            },
        });
    }

    /**
     * 构建按稳定坐标索引的句子映射，供批次取句与前后文邻居查询使用。
     *
     * @param sentences 当前字幕文件的完整句子列表。
     * @returns 坐标到句子的映射。
     */
    private buildSentencesByIndex(sentences: Sentence[]): Map<number, Sentence> {
        return new Map(sentences.map((sentence) => [sentence.index, sentence]));
    }

    /**
     * 释放指定字幕文件的翻译会话。
     *
     * @param fileHash 字幕文件哈希。
     * @param rendererSessionId 当前 renderer 进程的会话标识。
     */
    public releaseSession(fileHash: string, rendererSessionId: string): void {
        const normalized = fileHash.trim();
        if (!normalized) {
            return;
        }
        this.scheduler.release(normalized, rendererSessionId);
    }

    /**
     * 执行调度器选出的固定大小批次。
     *
     * @param request 当前批次参数。
     * @returns 已完成、最终失败与取消的字幕索引。
     */
    private async executeBatch(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>
    ): Promise<SubtitleTranslationBatchResult> {
        const completedIndices = new Set<number>();
        const failedIndices = new Set<number>();
        const batchStartedAt = Date.now();
        const targets = request.indices
            .map((index) => request.context.sentencesByIndex.get(index))
            .filter((sentence): sentence is Sentence => Boolean(sentence));

        this.logger.info('字幕翻译批次开始', {
            fileHash: request.fileHash,
            batchId: request.batchId,
            demandId: request.demandId,
            provider: request.context.provider,
            mode: request.context.mode,
            priority: request.priority,
            requeueCount: request.requeueCount,
            indexStart: request.indices[0],
            indexEnd: request.indices[request.indices.length - 1],
            batchSize: request.indices.length,
        });

        request.indices.forEach((index) => {
            if (!request.context.sentencesByIndex.has(index)) {
                failedIndices.add(index);
            }
        });

        try {
            this.throwIfAborted(request.signal);
            const pending = await this.resolveCachedAndSkippedTargets(
                request,
                targets,
                completedIndices
            );
            if (pending.length === 0) {
                this.logger.info('字幕翻译批次缓存完成', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    provider: request.context.provider,
                    mode: request.context.mode,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                    completedCount: completedIndices.size,
                    failedCount: failedIndices.size,
                    elapsedMs: Date.now() - batchStartedAt,
                });
                return {
                    completedIndices: Array.from(completedIndices),
                    failedIndices: Array.from(failedIndices),
                    cancelled: false,
                };
            }

            const onlineResults = request.context.provider === 'tencent'
                ? await this.translateWithTencent(request, pending)
                : await this.translateWithOpenAi(request, pending);
            this.throwIfAborted(request.signal);
            if (!request.context.transient) {
                await this.saveTranslations(onlineResults, request.context.storageMode);
            }
            this.pushTranslations(onlineResults, request.context);

            const translatedKeys = new Set(onlineResults.keys());
            pending.forEach((sentence) => {
                if (translatedKeys.has(sentence.translationKey)) {
                    completedIndices.add(sentence.index);
                } else {
                    failedIndices.add(sentence.index);
                }
            });

            this.logger.info('字幕翻译批次完成', {
                fileHash: request.fileHash,
                batchId: request.batchId,
                demandId: request.demandId,
                provider: request.context.provider,
                mode: request.context.mode,
                priority: request.priority,
                requeueCount: request.requeueCount,
                indexStart: request.indices[0],
                indexEnd: request.indices[request.indices.length - 1],
                batchSize: request.indices.length,
                completedCount: completedIndices.size,
                failedCount: failedIndices.size,
                onlineTargetCount: pending.length,
                elapsedMs: Date.now() - batchStartedAt,
            });

            if (failedIndices.size > 0 && request.requeueCount > 0) {
                this.showFailureToast(
                    request.context.provider === 'openai'
                        ? `OpenAI 字幕翻译未返回完整结果，失败 ${failedIndices.size} 条`
                        : `腾讯字幕翻译未返回完整结果，失败 ${failedIndices.size} 条`,
                    `subtitle-translation:${request.context.provider}-incomplete:${request.context.mode}`,
                );
            }

            return {
                completedIndices: Array.from(completedIndices),
                failedIndices: Array.from(failedIndices),
                cancelled: false,
            };
        } catch (error) {
            if (request.signal.aborted) {
                return {
                    completedIndices: Array.from(completedIndices),
                    failedIndices: [],
                    cancelled: true,
                };
            }

            targets.forEach((sentence) => {
                if (!completedIndices.has(sentence.index)) {
                    failedIndices.add(sentence.index);
                }
            });
            this.logger.warn('字幕翻译批次执行失败', {
                fileHash: request.fileHash,
                batchId: request.batchId,
                demandId: request.demandId,
                priority: request.priority,
                requeueCount: request.requeueCount,
                provider: request.context.provider,
                mode: request.context.mode,
                indexStart: request.indices[0],
                indexEnd: request.indices[request.indices.length - 1],
                batchSize: request.indices.length,
                elapsedMs: Date.now() - batchStartedAt,
                error,
            });
            if (request.requeueCount > 0) {
                this.showFailureToast(
                    request.context.provider === 'openai'
                        ? 'OpenAI 字幕翻译请求失败'
                        : '腾讯字幕翻译请求失败',
                    `subtitle-translation:${request.context.provider}-batch-failed:${request.context.mode}`,
                    error,
                );
            }
            return {
                completedIndices: Array.from(completedIndices),
                failedIndices: Array.from(failedIndices),
                cancelled: false,
            };
        }
    }

    /**
     * 回传缓存命中与无需在线翻译的字幕，并返回剩余目标。
     *
     * @param request 当前批次参数。
     * @param targets 当前批次有效字幕。
     * @param completedIndices 已完成索引集合。
     * @returns 仍需在线翻译的字幕。
     */
    private async resolveCachedAndSkippedTargets(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: Sentence[],
        completedIndices: Set<number>
    ): Promise<Sentence[]> {
        const cached = await this.getTranslations(
            targets.map((sentence) => sentence.translationKey),
            request.context.storageMode
        );
        if (cached.size > 0) {
            this.pushTranslations(cached, request.context);
            targets.forEach((sentence) => {
                if (cached.has(sentence.translationKey)) {
                    completedIndices.add(sentence.index);
                }
            });
        }

        const uncached = targets.filter(
            (sentence) => !cached.has(sentence.translationKey)
        );
        const skipped = uncached.filter(
            (sentence) => !shouldTranslateSubtitleText(sentence.text)
        );
        if (skipped.length > 0) {
            const unchanged = new Map<string, string>();
            skipped.forEach((sentence) => {
                unchanged.set(sentence.translationKey, sentence.text);
                completedIndices.add(sentence.index);
            });
            if (!request.context.transient) {
                await this.saveTranslations(unchanged, request.context.storageMode);
            }
            this.pushTranslations(unchanged, request.context);
        }

        return uncached.filter((sentence) => shouldTranslateSubtitleText(sentence.text));
    }

    /**
     * 使用腾讯批量接口翻译当前目标。
     *
     * @param targets 当前未命中缓存的字幕。
     * @param signal 当前批次取消信号。
     * @returns 以稳定字幕键索引的翻译结果。
     */
    private async translateWithTencent(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: Sentence[],
    ): Promise<Map<string, string>> {
        const client = this.tencentProvider.getClient();
        if (!client) {
            throw new Error('腾讯翻译客户端未初始化，请检查密钥配置');
        }

        this.throwIfAborted(request.signal);
        const holder = await concurrency.withRateLimit(
            'tencent',
            () => client.batchTrans(
                targets.map((sentence) => sentence.text),
                {
                    batchId: request.batchId,
                    fileHash: request.fileHash,
                }
            ),
            { signal: request.signal }
        );
        this.throwIfAborted(request.signal);

        const translations = new Map<string, string>();
        targets.forEach((sentence) => {
            const translation = holder.get(sentence.text)?.trim();
            if (translation) {
                translations.set(sentence.translationKey, translation);
            }
        });
        return translations;
    }

    /**
     * 使用腾讯接口翻译不属于播放窗口的独立文本批次。
     *
     * @param targets 使用归一化原文作为 key 的目标条目。
     * @param batchId 日志关联批次编号。
     * @returns 归一化原文到翻译结果的映射。
     */
    private async translateDirectWithTencent(
        targets: DirectTranslationTarget[],
        batchId: string
    ): Promise<Map<string, string>> {
        const client = this.tencentProvider.getClient();
        if (!client) {
            throw new Error('腾讯翻译客户端未初始化，请检查密钥配置');
        }

        const holder = await client.batchTrans(
            targets.map((target) => target.text),
            {
                batchId,
                fileHash: 'direct',
            }
        );
        const translations = new Map<string, string>();
        targets.forEach((target) => {
            const translation = holder.get(target.text)?.trim();
            if (translation) {
                translations.set(target.key, translation);
            }
        });
        return translations;
    }

    /**
     * 使用 OpenAI 非流式结构化输出翻译当前目标。
     *
     * 失败后的重新执行由窗口调度器统一控制，当前方法本身只发起一次请求。
     *
     * @param request 当前批次参数。
     * @param targets 当前未命中缓存的字幕。
     * @returns 以稳定字幕键索引的完整翻译结果。
     */
    private async translateWithOpenAi(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: Sentence[]
    ): Promise<Map<string, string>> {
        const style = request.context.style;
        if (!style) {
            throw new Error('OpenAI 字幕翻译风格配置缺失');
        }

        const targetItems: OpenAiSubtitleTranslationTarget[] = targets.map((sentence) => ({
            key: sentence.translationKey,
            text: sentence.text,
        }));
        const firstIndex = targets[0].index;
        const lastIndex = targets[targets.length - 1].index;
        // 前后文邻居按稳定坐标取：坐标相邻即时间相邻；跨分片间隔处查不到邻居则上下文留空。
        const contextBefore = this.buildContextItem(
            request.context.sentencesByIndex.get(firstIndex - 1)
        );
        const contextAfter = this.buildContextItem(
            request.context.sentencesByIndex.get(lastIndex + 1)
        );
        const prompt = buildSubtitleBatchPrompt({
            targets: targetItems,
            contextBefore: contextBefore ? [contextBefore] : [],
            contextAfter: contextAfter ? [contextAfter] : [],
        }, style);
        const translationDescription = this.getTranslationDescription(request.context.mode);
        this.throwIfAborted(request.signal);
        const items = await this.openAiGateway.translate({
            prompt,
            translationDescription,
            signal: request.signal,
        });
        const validated = this.validateOpenAiItems(targetItems, items);
        return validated;
    }

    /**
     * 使用当前批量 Prompt 翻译不属于播放窗口的独立文本批次。
     *
     * @param targets 使用归一化原文作为 key 的目标条目。
     * @param mode 当前字幕翻译模式。
     * @param style 已解析的 OpenAI 风格约束。
     * @returns 归一化原文到翻译结果的映射。
     */
    private async translateDirectWithOpenAi(
        targets: DirectTranslationTarget[],
        mode: TranslationMode,
        style?: string
    ): Promise<Map<string, string>> {
        if (!style) {
            throw new Error('OpenAI 字幕翻译风格配置缺失');
        }
        const prompt = buildSubtitleBatchPrompt({
            targets,
            contextBefore: [],
            contextAfter: [],
        }, style);
        const items = await this.openAiGateway.translate({
            prompt,
            translationDescription: this.getTranslationDescription(mode),
            signal: new AbortController().signal,
        });
        return this.validateOpenAiItems(targets, items);
    }

    /**
     * 严格校验模型返回的 key 集合与非空翻译。
     *
     * @param targets 当前请求目标。
     * @param items 模型返回条目。
     * @returns 以稳定字幕键索引的翻译结果。
     */
    private validateOpenAiItems(
        targets: OpenAiSubtitleTranslationTarget[],
        items: OpenAiSubtitleTranslationResultItem[]
    ): Map<string, string> {
        if (items.length !== targets.length) {
            throw createSubtitleValidationError(
                `返回条目数量不匹配: expected=${targets.length}, actual=${items.length}`
            );
        }

        const targetKeys = new Set(targets.map((target) => target.key));
        const result = new Map<string, string>();
        items.forEach((item) => {
            if (!targetKeys.has(item.key)) {
                throw createSubtitleValidationError(`返回了未知字幕键: ${item.key}`);
            }
            if (result.has(item.key)) {
                throw createSubtitleValidationError(`重复返回字幕键: ${item.key}`);
            }
            const translation = item.translation.trim();
            if (!translation) {
                throw createSubtitleValidationError(`字幕翻译为空: ${item.key}`);
            }
            result.set(item.key, translation);
        });

        targets.forEach((target) => {
            if (!result.has(target.key)) {
                throw createSubtitleValidationError(`缺少字幕键: ${target.key}`);
            }
        });
        return result;
    }

    /**
     * 将相邻字幕转换为只读上下文条目。
     *
     * @param sentence 相邻字幕；不存在时为空。
     * @returns 可写入提示词的上下文条目。
     */
    private buildContextItem(
        sentence: Sentence | undefined
    ): OpenAiSubtitleTranslationTarget | null {
        if (!sentence || !shouldTranslateSubtitleText(sentence.text)) {
            return null;
        }
        return {
            key: sentence.translationKey,
            text: sentence.text,
        };
    }

    /**
     * 返回当前模式下 translation 字段的结构说明。
     *
     * @param mode 当前字幕模式。
     * @returns 英文结构字段说明。
     */
    private getTranslationDescription(mode: TranslationMode): string {
        if (mode === 'zh') {
            return 'The translated sentence in Simplified Chinese.';
        }
        if (mode === 'simple_en') {
            return 'The simplified English sentence that preserves the original meaning and subtitle readability.';
        }
        return 'The generated subtitle sentence that follows the custom style.';
    }

    /**
     * 批量查询当前模式下的句级翻译缓存。
     *
     * @param keys 稳定字幕键。
     * @param mode 持久化缓存模式。
     * @returns 有效的非空翻译映射。
     */
    private async getTranslations(
        keys: string[],
        mode: SubtitleTranslationStorageMode
    ): Promise<Map<string, string>> {
        if (keys.length === 0) {
            return new Map();
        }
        const values = await this.sentenceTranslatesRepository
            .findBySentencesAndMode(keys, mode);
        const result = new Map<string, string>();
        values.forEach((value) => {
            const translation = value.translate?.trim();
            if (value.sentence && translation) {
                result.set(value.sentence, translation);
            }
        });
        return result;
    }

    /**
     * 批量持久化句级翻译结果。
     *
     * @param translations 稳定字幕键到翻译文本的映射。
     * @param mode 持久化缓存模式。
     */
    private async saveTranslations(
        translations: Map<string, string>,
        mode: SubtitleTranslationStorageMode
    ): Promise<void> {
        if (translations.size === 0) {
            return;
        }
        await this.sentenceTranslatesRepository.upsertMany(
            Array.from(translations.entries()).map(([sentence, translate]) => ({
                sentence,
                translate,
                mode,
                updated_at: TimeUtil.timeUtc(),
            }))
        );
    }

    /**
     * 向渲染层批量推送当前配置下的最终翻译结果。
     *
     * @param translations 稳定字幕键到翻译文本的映射。
     * @param context 当前字幕翻译配置。
     */
    private pushTranslations(
        translations: Map<string, string>,
        context: SubtitleTranslationExecutionContext
    ): void {
        if (translations.size === 0) {
            return;
        }
        const items: RendererTranslationItem[] = Array
            .from(translations.entries())
            .map(([key, translation]) => ({
                key,
                fileHash: context.fileHash,
                translation,
                provider: context.provider,
                mode: context.mode,
            }));
        this.rendererGateway.fireAndForget('translation/batch-result', {
            translations: items,
        });
    }

    /**
     * 检查当前批次是否已经取消。
     *
     * @param signal 当前批次取消信号。
     */
    private throwIfAborted(signal: AbortSignal): void {
        if (signal.aborted) {
            throw createAbortError();
        }
    }

    /**
     * 记录失败原因并向前端发送去重错误提示。
     *
     * @param message 面向用户的主消息。
     * @param dedupeKey 弹窗去重键。
     * @param error 可选原始异常。
     */
    private showFailureToast(
        message: string,
        dedupeKey: string,
        error?: unknown
    ): void {
        const errorMessage = errorToBriefMessage(error);
        const combinedMessage = errorMessage
            ? truncate(`${message}（${errorMessage}）`, 220)
            : message;
        this.rendererGateway.fireAndForget('ui/show-toast', {
            title: '字幕翻译失败',
            message: combinedMessage,
            variant: 'error',
            bubble: true,
            dedupeKey,
            duration: 6500,
        });
    }
}
