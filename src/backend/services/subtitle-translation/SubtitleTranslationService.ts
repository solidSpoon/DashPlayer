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
import {
    buildContextStorageKeyForSentence,
    buildSentenceStorageKey,
    resolvePromptNeighbor,
    shouldTranslateSubtitleText,
} from '@/backend/services/subtitle-translation/SubtitleTranslationCacheKey';
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
                cacheHitCount: cached.size,
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
            const { onlineTargets, cacheHitCount } = await this.resolveCachedAndSkippedTargets(
                request,
                targets,
                completedIndices
            );
            if (onlineTargets.length === 0) {
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
                    cacheHitCount,
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
                : await this.translateWithOpenAi(request, onlineTargets);
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
                mode: request.context.mode,
                priority: request.priority,
                requeueCount: request.requeueCount,
                indexStart: request.indices[0],
                indexEnd: request.indices[request.indices.length - 1],
                batchSize: request.indices.length,
                cacheHitCount,
                completedCount: completedIndices.size,
                failedCount: failedIndices.size,
                onlineTargetCount: onlineTargets.length,
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
                storageKey: provider === 'openai'
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
     * 回传缓存命中与无需在线翻译的字幕，并返回剩余在线翻译目标。
     *
     * @param request 当前批次参数。
     * @param targets 当前批次有效字幕描述符。
     * @param completedIndices 已完成索引集合，命中与跳过句就地追加。
     * @returns 仍需在线翻译的目标与缓存命中句数。
     */
    private async resolveCachedAndSkippedTargets(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: SubtitleBatchTarget[],
        completedIndices: Set<number>
    ): Promise<{ onlineTargets: SubtitleBatchTarget[]; cacheHitCount: number }> {
        const uniqueStorageKeys = Array.from(
            new Set(targets.map((target) => target.storageKey))
        );
        const cachedByStorageKey = await this.getTranslations(
            uniqueStorageKeys,
            request.context.storageMode
        );
        const cached = new Map<string, string>();
        targets.forEach((target) => {
            const translation = cachedByStorageKey.get(target.storageKey);
            if (translation) {
                cached.set(target.publishKey, translation);
            }
        });
        if (cached.size > 0) {
            this.pushTranslations(cached, request.context);
            targets.forEach((target) => {
                if (cached.has(target.publishKey)) {
                    completedIndices.add(target.index);
                }
            });
        }

        const uncached = targets.filter((target) => !cached.has(target.publishKey));
        const skipped = uncached.filter(
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

        return {
            onlineTargets: uncached.filter(
                (target) => shouldTranslateSubtitleText(target.text)
            ),
            cacheHitCount: cached.size,
        };
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
     * 提示词中的回显键使用 renderer 定位键而非数据库存储键：存储键是长哈希，
     * 要求模型逐字回抄会放大整批失败面，且同批重复原文会塌成相同键被判定重复返回。
     *
     * @param request 当前批次参数。
     * @param targets 当前未命中缓存的字幕描述符。
     * @returns 以 renderer 定位键索引的完整翻译结果。
     */
    private async translateWithOpenAi(
        request: SubtitleTranslationBatchRequest<SubtitleTranslationExecutionContext>,
        targets: SubtitleBatchTarget[]
    ): Promise<Map<string, string>> {
        const style = request.context.style;
        if (!style) {
            throw new Error('OpenAI 字幕翻译风格配置缺失');
        }

        const targetItems: OpenAiSubtitleTranslationTarget[] = targets.map((target) => ({
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
     * 邻居取值复用 resolvePromptNeighbor，与存储键计算共用同一判据，
     * 避免出现"键认为邻居存在、提示词认为不存在"的分歧。
     *
     * @param sentence 相邻字幕；不存在时为空。
     * @returns 可写入提示词的上下文条目；无可用文本时为空。
     */
    private buildContextItem(
        sentence: Sentence | undefined
    ): OpenAiSubtitleTranslationTarget | null {
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
