import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import CacheService from '@/backend/services/CacheService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import ModelRoutingService from '@/backend/services/ModelRoutingService';
import SettingService from '@/backend/services/SettingService';
import type ResourceFallbackService from '@/backend/services/ResourceFallbackService';
import type LocalAiService from '@/backend/services/LocalAiService';
import LocalSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalSubtitleBatchTranslator';
import LocalMtSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalMtSubtitleBatchTranslator';
import OpenAiSubtitleBatchTranslator from '@/backend/services/gateways/translate/OpenAiSubtitleBatchTranslator';
import {
    SubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
    SubtitleTranslationTarget,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import { TencentTranslateClient } from '@/backend/services/gateways/translate/TencentTranslateClient';
import SentenceTranslatesRepository from '@/backend/services/repositories/SentenceTranslatesRepository';
import SubtitleTranslationScheduler, {
    SubtitleTranslationBatchRequest,
    SubtitleTranslationBatchResult,
} from '@/backend/services/subtitle-translation/SubtitleTranslationScheduler';
import {
    buildContextStorageKeyForSentence,
    buildSentenceStorageKey,
    resolvePromptNeighbor,
    shouldTranslateSubtitleText,
} from '@/backend/services/subtitle-translation/SubtitleTranslationCacheKey';
import {
    buildSubtitleStorageMode,
    SubtitleTranslationStorageMode,
} from '@/backend/services/subtitle-translation/SubtitleTranslationStorageMode';
import { LOCAL_MT_MODEL_ID } from '@/common/contracts/local-mt';
import { concurrency } from '@/backend/utils/concurrency';
import {
    resolveSubtitleStyleWithSignature,
} from '@/common/constants/openaiSubtitlePrompts';
import { Sentence } from '@/common/types/SentenceC';
import {
    RendererTranslationItem,
    TranslationMode,
    TranslationProvider,
} from '@/common/types/TranslationResult';
import TimeUtil from '@/common/utils/TimeUtil';

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
    /** 本地引擎使用中的模型 ID；云端引擎为 null。网关请求从这里取模型，不再二次读设置。 */
    localModelId: string | null;
    /**
     * 当前字幕文件按稳定坐标（sentence.index）索引的句子映射。
     * 增量转录会话的坐标为「分片序号 × 100000 + 片内序号」，与数组下标不同，
     * 因此取句、前后文邻居查询都必须走该映射而非数组下标。
     */
    sentencesByIndex: Map<number, Sentence>;
    /** 当前字幕文件哈希。 */
    fileHash: string;
    /** OpenAI 批量提示词使用的风格约束。 */
    style?: string;
}

/**
 * 批次内单个待翻译句子的描述符。
 *
 * 一次批次里每个句子都先生成该描述符，后续查缓存、发起在线请求、落库全程复用，
 * 避免同一句的存储键在链路上被重复计算而出现不一致。
 */
interface SubtitleBatchTarget {
    /** 句子的稳定坐标（sentence.index），用于回写批次完成与失败集合。 */
    index: number;
    /**
     * 回推 renderer 用于定位句子的键，等于 Sentence.translationKey。
     * 前端译文 Map 与 OpenAI 批量的回显键都使用它，不参与数据库寻址。
     */
    publishKey: string;
    /**
     * 数据库 sentence 列的存储键，由本次请求的实际输入形态派生：
     * OpenAI 带上下文批量为三句键，腾讯批量与无上下文直翻为单句键。
     */
    storageKey: string;
    /** 字幕原文，保留大小写，用于送翻译与跳过判定。 */
    text: string;
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
     * 删除当前字幕翻译配置（引擎、模型与风格完全一致）产生的全部缓存。
     *
     * 供“对译文质量不满意、想重新翻译”的场景使用：只精确删除当前配置对应的
     * 缓存模式键，不影响其他引擎、模型或风格的历史缓存。
     *
     * @returns 实际删除的记录数。
     */
    clearTranslationCache(): Promise<number>;

    /**
     * 更新当前播放位置；方法只负责提交需求，不等待远端翻译完成。
     *
     * @param input 当前字幕文件与播放索引。
     */
    updateDemand(input: SubtitleTranslationDemandInput): Promise<void>;

    /**
     * 释放指定字幕文件的内存会话；在途批次继续执行完成并写缓存，不再调度新批次。
     *
     * @param fileHash 字幕文件哈希。
     * @param rendererSessionId 当前 renderer 进程的会话标识。
     */
    releaseSession(fileHash: string, rendererSessionId: string): void;
}

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

/** 批次失败提示里的引擎展示名；新引擎接入时在此补一行。 */
const PROVIDER_LABELS: Partial<Record<TranslationProvider, string>> = {
    'local-mt': '轻量翻译',
    local: '本地模型',
    openai: 'OpenAI',
};

/**
 * 负责字幕缓存查询、在线翻译、结果持久化与窗口调度。
 */
@injectable()
export class SubtitleTranslationServiceImpl implements SubtitleTranslationService {
    private readonly logger = getMainLogger('SubtitleTranslationServiceImpl');

    @inject(TYPES.SettingService)
    private settingService!: SettingService;

    @inject(TYPES.LocalAiService)
    private localAiService!: LocalAiService;

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

    @inject(TYPES.OpenAiSubtitleBatchTranslator)
    private openAiSubtitleTranslator!: OpenAiSubtitleBatchTranslator;

    @inject(TYPES.LocalSubtitleBatchTranslator)
    private localSubtitleTranslator!: LocalSubtitleBatchTranslator;

    @inject(TYPES.LocalMtSubtitleBatchTranslator)
    private localMtSubtitleTranslator!: LocalMtSubtitleBatchTranslator;

    @inject(TYPES.ResourceFallbackService)
    private resourceFallback!: ResourceFallbackService;

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
            const key = buildSentenceStorageKey(trimmed);
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

        const { mode, storageMode, style, localModelId } = await this.resolveCurrentStorageContext(provider);

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
        });

        const onlineTargets = pending.filter(
            (target) => shouldTranslateSubtitleText(target.text)
        );
        if (onlineTargets.length > 0) {
            const batchId = `direct-${Date.now()}`;
            const startedAt = Date.now();
            const onlineResults = provider === 'tencent'
                ? await this.translateDirectWithTencent(onlineTargets, batchId)
                : await this.translateDirectWithGateway(onlineTargets, mode, style, localModelId, provider);
            onlineResults.forEach((translation, key) => {
                result.set(key, translation);
                freshResults.set(key, translation);
            });
            this.logger.info('独立字幕批次翻译完成', {
                batchId,
                provider,
                mode,
                cacheHitCount: cached.size,
                targetCount: onlineTargets.length,
                elapsedMs: Date.now() - startedAt,
            });
        }

        await this.saveTranslations(freshResults, storageMode);
        return result;
    }

    public async clearTranslationCache(): Promise<number> {
        const provider = await this.settingService.getCurrentTranslationProvider();
        if (!provider) {
            throw new Error('未启用字幕翻译服务');
        }
        const { storageMode } = await this.resolveCurrentStorageContext(provider);
        const deleted = await this.sentenceTranslatesRepository.deleteByMode(storageMode);
        this.logger.info('已清除当前配置的字幕翻译缓存', { provider, storageMode, deleted });
        return deleted;
    }

    /**
     * 解析当前设置对应的风格、持久化缓存模式与调度 profileKey。
     *
     * 这是设置到缓存键/网关引擎路径的唯一解析入口：播放调度与独立直翻都从这里取值，
     * 避免同一配置在多处重复拼装后产生不一致。
     *
     * @param provider 当前字幕翻译 provider。
     * @returns 翻译模式、缓存模式、风格、调度 profileKey 与本地模型 ID（云端为 null）；
     *          OpenAI 引擎未配置模型时抛出显式错误。
     */
    private async resolveCurrentStorageContext(
        provider: NonNullable<Awaited<ReturnType<SettingService['getCurrentTranslationProvider']>>>
    ): Promise<{
        mode: TranslationMode,
        storageMode: SubtitleTranslationStorageMode,
        style?: string,
        profileKey: string,
        localModelId: string | null,
    }> {
        if (provider === 'tencent') {
            return { mode: 'zh', storageMode: 'tencent', profileKey: 'tencent', localModelId: null };
        }
        if (provider === 'local-mt') {
            // 专用翻译模型只支持中文模式，固定 mode 与存储模式；无风格概念。
            const storageMode = buildSubtitleStorageMode('local-mt', LOCAL_MT_MODEL_ID, 'zh', '');
            return { mode: 'zh', storageMode, style: undefined, profileKey: storageMode, localModelId: null };
        }
        const mode = await this.settingService.getOpenAiSubtitleTranslationMode();
        const customStyle = mode === 'custom'
            ? await this.settingService.getOpenAiSubtitleCustomStyle()
            : undefined;
        const resolved = resolveSubtitleStyleWithSignature(mode, customStyle);
        const localModelId = provider === 'local' ? await this.localAiService.getActiveModelId() : null;
        if (provider === 'local') {
            // 本地引擎缺少模型标识时显式失败，不滑入云端路由掩盖配置问题。
            if (!localModelId) throw new Error('本地字幕翻译模型未配置');
            const storageMode = buildSubtitleStorageMode('local', localModelId, mode, resolved.signature);
            return { mode, storageMode, style: resolved.style, profileKey: `${storageMode}:${localModelId}`, localModelId };
        }
        const routed = this.modelRoutingService.resolveOpenAiModel('subtitleTranslation');
        if (!routed) throw new Error('OpenAI 字幕翻译模型未配置');
        const storageMode = buildSubtitleStorageMode('openai', routed.modelId, mode, resolved.signature);
        return { mode, storageMode, style: resolved.style, profileKey: `${storageMode}:${routed.fullModelId}`, localModelId: null };
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
                    localModelId: null,
                    sentencesByIndex: this.buildSentencesByIndex(srtData.sentences),
                    fileHash,
                },
            });
            return;
        }

        let resolvedContext;
        try {
            resolvedContext = await this.resolveCurrentStorageContext(provider);
        } catch (error) {
            this.scheduler.release(fileHash, input.rendererSessionId);
            throw error;
        }
        const { mode, storageMode, style, profileKey, localModelId } = resolvedContext;
        this.scheduler.updateDemand({
            fileHash,
            currentIndex: input.currentIndex,
            demandId: input.demandId,
            rendererSessionId: input.rendererSessionId,
            sentenceIndices,
            profileKey,
            context: {
                provider,
                storageMode,
                mode,
                localModelId,
                sentencesByIndex: this.buildSentencesByIndex(srtData.sentences),
                fileHash,
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
        const targets = this.buildBatchTargets(request);

        this.logger.info('字幕翻译批次开始', {
            fileHash: request.fileHash,
            batchId: request.batchId,
            demandId: request.demandId,
            provider: request.context.provider,
            localModelId: request.context.localModelId,
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
            const onlineTargets = await this.resolveBatchTargets(
                request,
                targets,
                completedIndices
            );
            const skippedCount = targets.length - onlineTargets.length;
            if (onlineTargets.length === 0) {
                this.logger.info('字幕翻译批次无需在线翻译', {
                    fileHash: request.fileHash,
                    batchId: request.batchId,
                    demandId: request.demandId,
                    provider: request.context.provider,
                    localModelId: request.context.localModelId,
                    mode: request.context.mode,
                    priority: request.priority,
                    requeueCount: request.requeueCount,
                    indexStart: request.indices[0],
                    indexEnd: request.indices[request.indices.length - 1],
                    batchSize: request.indices.length,
                    skippedCount,
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
                ? await this.translateWithTencent(request, onlineTargets)
                : await this.translateWithGateway(request, onlineTargets);
            this.throwIfAborted(request.signal);
            await this.saveTranslations(
                this.toStorageKeyedTranslations(onlineResults, onlineTargets),
                request.context.storageMode
            );
            this.pushTranslations(onlineResults, request.context);

            const translatedKeys = new Set(onlineResults.keys());
            onlineTargets.forEach((target) => {
                if (translatedKeys.has(target.publishKey)) {
                    completedIndices.add(target.index);
                } else {
                    failedIndices.add(target.index);
                }
            });

            this.logger.info('字幕翻译批次完成', {
                fileHash: request.fileHash,
                batchId: request.batchId,
                demandId: request.demandId,
                provider: request.context.provider,
                localModelId: request.context.localModelId,
                mode: request.context.mode,
                priority: request.priority,
                requeueCount: request.requeueCount,
                indexStart: request.indices[0],
                indexEnd: request.indices[request.indices.length - 1],
                batchSize: request.indices.length,
                skippedCount,
                completedCount: completedIndices.size,
                failedCount: failedIndices.size,
                onlineTargetCount: onlineTargets.length,
                elapsedMs: Date.now() - batchStartedAt,
            });

            if (failedIndices.size > 0 && request.requeueCount > 0) {
                const engineLabel = PROVIDER_LABELS[request.context.provider] ?? '翻译';
                this.showFailureToast(
                    request.context.provider !== 'tencent'
                        ? `${engineLabel}字幕翻译未返回完整结果，失败 ${failedIndices.size} 条`
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

            targets.forEach((target) => {
                if (!completedIndices.has(target.index)) {
                    failedIndices.add(target.index);
                }
            });
            this.logger.warn('字幕翻译批次执行失败', {
                fileHash: request.fileHash,
                batchId: request.batchId,
                demandId: request.demandId,
                priority: request.priority,
                requeueCount: request.requeueCount,
                provider: request.context.provider,
                localModelId: request.context.localModelId,
                mode: request.context.mode,
                indexStart: request.indices[0],
                indexEnd: request.indices[request.indices.length - 1],
                batchSize: request.indices.length,
                elapsedMs: Date.now() - batchStartedAt,
                error,
            });
            if (request.requeueCount > 0) {
                const engineLabel = PROVIDER_LABELS[request.context.provider] ?? '翻译';
                this.showFailureToast(
                    request.context.provider !== 'tencent'
                        ? `${engineLabel}字幕翻译请求失败`
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
     * 把批次坐标解析为翻译目标描述符，并在此一次算出数据库存储键。
     *
     * 存储键的前后文邻居取句子自身坐标的上下句而非批首尾，保证键只绑句子的语义邻域、
     * 与批次如何划分无关；播放窗口移动导致批次重组时，同一句的键保持稳定。
     * OpenAI 批量带上下文因此使用三句键，腾讯批量只吃单句原文因此使用单句键。
     *
     * @param request 当前批次参数。
     * @returns 批次内可取到句子的描述符列表。
     */
    private buildBatchTargets(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>
    ): SubtitleBatchTarget[] {
        const { provider, sentencesByIndex } = request.context;
        return request.indices
            .map((index) => sentencesByIndex.get(index))
            .filter((sentence): sentence is Sentence => Boolean(sentence))
            .map((sentence) => ({
                index: sentence.index,
                publishKey: sentence.translationKey,
                // 依赖上下文的引擎（OpenAI/本地 LLM）用三句键，独立句翻译引擎（腾讯/轻量 MT）用单句键。
                storageKey: provider === 'openai' || provider === 'local'
                    ? buildContextStorageKeyForSentence(sentence, sentencesByIndex)
                    : buildSentenceStorageKey(sentence.text),
                text: sentence.text,
            }));
    }

    /**
     * 把以 renderer 定位键索引的结果投影为以数据库存储键索引的结果。
     *
     * 这是批次链路上唯一一次定位键到存储键的转换，只在进出数据库时发生。
     * 同一批内出现重复原文时，相同存储键会被覆盖为同值，落库为幂等 upsert。
     *
     * @param translations 定位键到翻译文本的映射。
     * @param targets 产生该批结果所用的描述符，提供定位键与存储键的对应关系。
     * @returns 存储键到翻译文本的映射。
     */
    private toStorageKeyedTranslations(
        translations: Map<string, string>,
        targets: SubtitleBatchTarget[]
    ): Map<string, string> {
        const result = new Map<string, string>();
        targets.forEach((target) => {
            const translation = translations.get(target.publishKey);
            if (translation) {
                result.set(target.storageKey, translation);
            }
        });
        return result;
    }

    /**
     * 解析无需在线翻译的句子，并返回需要发给模型的整组在线翻译目标。
     *
     * 缓存命中的句子不再从批次中剔除：命中过的也随整组重发，
     * 保证提示词内的字幕永远连续。仅两类例外：
     * - 整组全部命中缓存时直接复用缓存，不发起模型调用（没有 prompt 发出，不存在连续性问题）；
     * - 无可翻译文字的句子（如 ♪）按原文回传，不进入提示词。
     *
     * @param request 当前批次参数。
     * @param targets 当前批次有效字幕描述符。
     * @param completedIndices 已完成索引集合，命中与跳过句就地追加。
     * @returns 需要在线翻译的目标；全部命中或全部跳过时为空。
     */
    private async resolveBatchTargets(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: SubtitleBatchTarget[],
        completedIndices: Set<number>
    ): Promise<SubtitleBatchTarget[]> {
        const uniqueStorageKeys = Array.from(
            new Set(targets.map((target) => target.storageKey))
        );
        const cachedByStorageKey = await this.getTranslations(
            uniqueStorageKeys,
            request.context.storageMode
        );
        const isCached = (target: SubtitleBatchTarget): boolean =>
            Boolean(cachedByStorageKey.get(target.storageKey));

        // 整组全部命中缓存时直接复用，不发起模型调用；部分命中不剔除，整组重发。
        if (targets.length > 0 && targets.every(isCached)) {
            const cached = new Map<string, string>();
            targets.forEach((target) => {
                const translation = cachedByStorageKey.get(target.storageKey);
                if (translation) {
                    cached.set(target.publishKey, translation);
                }
                completedIndices.add(target.index);
            });
            this.pushTranslations(cached, request.context);
            return [];
        }

        const skipped = targets.filter(
            (target) => !shouldTranslateSubtitleText(target.text)
        );
        if (skipped.length > 0) {
            const unchanged = new Map<string, string>();
            skipped.forEach((target) => {
                unchanged.set(target.publishKey, target.text);
                completedIndices.add(target.index);
            });
            this.pushTranslations(unchanged, request.context);
        }

        return targets.filter((target) => shouldTranslateSubtitleText(target.text));
    }

    /**
     * 使用腾讯批量接口翻译当前目标。
     *
     * 腾讯接口只吃单句原文，因此结果按原文取回后以 renderer 定位键返回，
     * 存储键转换由调用方在落库前统一完成。
     *
     * @param request 当前批次参数。
     * @param targets 当前未命中缓存的字幕描述符。
     * @returns 以 renderer 定位键索引的翻译结果。
     */
    private async translateWithTencent(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: SubtitleBatchTarget[],
    ): Promise<Map<string, string>> {
        const client = this.tencentProvider.getClient();
        if (!client) {
            throw new Error('腾讯翻译客户端未初始化，请检查密钥配置');
        }

        this.throwIfAborted(request.signal);
        const holder = await concurrency.withRateLimit(
            'tencent',
            () => client.batchTrans(
                targets.map((target) => target.text),
                {
                    batchId: request.batchId,
                    fileHash: request.fileHash,
                }
            ),
            { signal: request.signal }
        );
        this.throwIfAborted(request.signal);

        const translations = new Map<string, string>();
        targets.forEach((target) => {
            const translation = holder.get(target.text)?.trim();
            if (translation) {
                translations.set(target.publishKey, translation);
            }
        });
        return translations;
    }

    /**
     * 使用腾讯接口翻译不属于播放窗口的独立文本批次。
     *
     * 与主路径 {@link translateWithTencent} 一致走 `tencent` 限流，避免直翻批次绕过配额触发上游限流。
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

        const holder = await concurrency.withRateLimit('tencent', () => client.batchTrans(
            targets.map((target) => target.text),
            {
                batchId,
                fileHash: 'direct',
            }
        ));
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
     * 通过字幕翻译网关（云端或本地引擎）对当前目标执行一次结构化翻译。
     *
     * 失败后的重新执行由窗口调度器统一控制，当前方法本身只发起一次请求。
     * 提示词中的回显键使用 renderer 定位键而非数据库存储键：存储键是长哈希，
     * 要求模型逐字回抄会放大整批失败面，且同批重复原文会塌成相同键被判定重复返回。
     *
     * @param request 当前批次参数。
     * @param targets 当前未命中缓存的字幕描述符。
     * @returns 以 renderer 定位键索引的完整翻译结果。
     */
    private async translateWithGateway(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: SubtitleBatchTarget[]
    ): Promise<Map<string, string>> {
        const style = request.context.style;
        if (!style && request.context.provider !== 'local-mt') {
            throw new Error('OpenAI 字幕翻译风格配置缺失');
        }

        const targetItems: SubtitleTranslationTarget[] = targets.map((target) => ({
            key: target.publishKey,
            text: target.text,
        }));
        const firstIndex = targets[0].index;
        const lastIndex = targets[targets.length - 1].index;
        // 提示词的前后文邻居取批首尾坐标的相邻句：跨分片间隔处查不到邻居则上下文留空。
        const contextBefore = this.buildContextItem(
            request.context.sentencesByIndex.get(firstIndex - 1)
        );
        const contextAfter = this.buildContextItem(
            request.context.sentencesByIndex.get(lastIndex + 1)
        );
        const input: SubtitleBatchTranslationInput = {
            targets: targetItems,
            contextBefore: contextBefore ? [contextBefore] : [],
            contextAfter: contextAfter ? [contextAfter] : [],
            mode: request.context.mode,
            style: style ?? '',
            signal: request.signal,
        };
        this.throwIfAborted(request.signal);
        // 引擎路由由已解析的设置决定；提示词拼装与输出细节各自归基础设施。
        return this.translateWithFallback(
            input,
            request.context.provider,
            request.context.localModelId,
            targetItems
        );
    }

    /**
     * 调用对应引擎翻译一批目标，失败时对这一批回退到基础资源（轻量翻译）。
     *
     * 云端与本地增强都建立在基础资源之上，它们失败时字幕不应直接空掉。
     * 回退只作用于失败的那一批：不设冷却窗口，每一批都会重新尝试当前引擎，
     * 原引擎恢复后立即生效。回退状态仅用于设置页展示，不短路后续批次。
     *
     * @param input 本批次的翻译输入。
     * @param provider 当前配置的引擎。
     * @param localModelId 本地增强模型标识；云端与轻量翻译为 null。
     * @param targets 本次要校验的目标条目。
     * @returns 校验后的翻译结果。
     */
    private async translateWithFallback(
        input: SubtitleBatchTranslationInput,
        provider: 'openai' | 'local' | 'local-mt' | 'tencent',
        localModelId: string | null,
        targets: SubtitleTranslationTarget[]
    ): Promise<Map<string, string>> {
        const translateWithLocalMt = async () => this.validateGatewayItems(
            targets,
            await this.localMtSubtitleTranslator.translate(input)
        );
        if (provider === 'local-mt') {
            return translateWithLocalMt();
        }
        if (provider === 'local' && !localModelId) {
            throw new Error('本地字幕翻译缺少模型标识');
        }
        const from = provider === 'local' ? (localModelId as string) : provider;
        try {
            const items = provider === 'local'
                ? await this.localSubtitleTranslator.translate({ ...input, modelId: localModelId as string })
                : await this.openAiSubtitleTranslator.translate(input);
            this.resourceFallback.clear('subtitleTranslation');
            return this.validateGatewayItems(targets, items);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.warn('字幕翻译引擎失败，回退到轻量翻译', { provider, from, reason });
            try {
                const result = await translateWithLocalMt();
                // 仅登记展示状态（设置页可见），不依据它短路后续批次。
                this.resourceFallback.markFallback('subtitleTranslation', from, 'local-mt', reason);
                return result;
            } catch (fallbackError) {
                this.logger.error('回退到轻量翻译同样失败', {
                    reason: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                });
                throw error;
            }
        }
    }

    /**
     * 使用当前批量 Prompt 翻译不属于播放窗口的独立文本批次。
     *
     * @param targets 使用归一化原文作为 key 的目标条目。
     * @param mode 当前字幕翻译模式。
     * @param style 已解析的风格约束。
     * @param localModelId 本地引擎使用中的模型 ID；云端引擎为 null。
     * @returns 归一化原文到翻译结果的映射。
     */
    private async translateDirectWithGateway(
        targets: DirectTranslationTarget[],
        mode: TranslationMode,
        style: string | undefined,
        localModelId: string | null,
        provider: 'openai' | 'local' | 'local-mt'
    ): Promise<Map<string, string>> {
        if (!style && provider !== 'local-mt') {
            throw new Error('OpenAI 字幕翻译风格配置缺失');
        }
        // 独立直翻场景没有播放窗口，不携带上下文。
        const input: SubtitleBatchTranslationInput = {
            targets: [...targets],
            contextBefore: [],
            contextAfter: [],
            mode,
            style: style ?? '',
            signal: new AbortController().signal,
        };
        return this.translateWithFallback(input, provider, localModelId, input.targets);
    }

    /**
     * 严格校验模型返回的 key 集合与非空翻译。
     *
     * @param targets 当前请求目标。
     * @param items 模型返回条目。
     * @returns 以稳定字幕键索引的翻译结果。
     */
    private validateGatewayItems(
        targets: SubtitleTranslationTarget[],
        items: SubtitleTranslationResultItem[]
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
     * 邻居取值复用 resolvePromptNeighbor，与存储键计算共用同一判据，
     * 避免出现"键认为邻居存在、提示词认为不存在"的分歧。
     *
     * @param sentence 相邻字幕；不存在时为空。
     * @returns 可写入提示词的上下文条目；无可用文本时为空。
     */
    private buildContextItem(
        sentence: Sentence | undefined
    ): SubtitleTranslationTarget | null {
        if (!sentence) {
            return null;
        }
        const text = resolvePromptNeighbor(sentence);
        if (text === null) {
            return null;
        }
        return {
            key: sentence.translationKey,
            text,
        };
    }

    /**
     * 批量查询当前模式下的句级翻译缓存。
     *
     * @param keys 数据库存储键（内容派生键，非 renderer 定位键）。
     * @param mode 持久化缓存模式。
     * @returns 有效的非空翻译映射，键为存储键。
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
     * @param translations 数据库存储键到翻译文本的映射。
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
     * @param translations renderer 定位键到翻译文本的映射。
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
