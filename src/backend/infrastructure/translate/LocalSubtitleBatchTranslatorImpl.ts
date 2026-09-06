import { inject, injectable } from 'inversify';
import { z } from 'zod';
import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';
import type LocalAiService from '@/backend/services/LocalAiService';
import LocalSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalSubtitleBatchTranslator';
import {
    LocalSubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import {
    buildSubtitleBatchPrompt,
    createSubtitleBatchResultSchema,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';

/**
 * 已知输出不稳定、需要逐句降级的小模型集合。
 *
 * 0.8B 整批翻译存在随机性条目错乱（多给/漏给/带出上下文键，生产日志
 * expected=5 actual=7 即此类），基准实测逐句模式成功率为 100%；
 * 更大的模型无此问题。注意：数字短键重映射实测反而降低整批成功率
 * （哈希键是更强的逐句锚点），不要改回。
 */
const SINGLE_SENTENCE_MODEL_IDS = new Set(['qwen3.5-0.8b-q4_k_m']);

/**
 * 照抄检测前对文本做的归一化：剥离所有非字母数字字符（含标点、空白）
 * 并转小写，避免“原文加个句号就绕过检测”的漏网。
 */
const normalizeForEchoCheck = (text: string): string =>
    text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

/** 文本是否包含 CJK 字符（即中文产物）。 */
const hasCjk = (text: string): boolean => /[\u4e00-\u9fff]/.test(text);

/** 源句是否是足够的西文句子（字母数达标），纯数字/短标记不在此列。 */
const isLatinSentence = (text: string): boolean =>
    (text.match(/[A-Za-z\u00C0-\u024F]/g) ?? []).length >= 4;

/**
 * 判断译文是否可用于中文模式：源句本身已是中文时原样返回属预期；
 * 西文句子的译文必须产出 CJK，且归一化后不得与原文相同。
 *
 * @returns 可用返回 true；不可用返回 false（视为照抄/未翻译）。
 */
const isUsableZhTranslation = (source: string, translation: string): boolean => {
    if (hasCjk(source)) return true;
    if (isLatinSentence(source) && !hasCjk(translation)) return false;
    return normalizeForEchoCheck(translation) !== normalizeForEchoCheck(source);
};

/** 单句照抄检测未通过时的最大生成尝试次数（首次 + 一次重试）。 */
const ECHO_CHECK_MAX_ATTEMPTS = 2;

type BatchResultSchema = ReturnType<typeof createSubtitleBatchResultSchema>;

/**
 * 本地字幕批量翻译网关：自持提示词拼装与 GGUF 结构化输出。
 *
 * 推理进程、模型加载与请求超时都由 LocalAiRuntime 管理；这里负责把语义输入
 * 拼成本地模型可执行的提示词，并校验输出形状。本地模型特有的容错策略
 * （小模型逐句降级）也落在本实现内，业务层不感知。
 */
@injectable()
export default class LocalSubtitleBatchTranslatorImpl
implements LocalSubtitleBatchTranslator {
    private readonly logger = getMainLogger('LocalSubtitleBatchTranslator');

    /** 注入本地推理服务。 */
    public constructor(
        @inject(TYPES.LocalAiService) private readonly localAi: LocalAiService,
    ) {}

    /**
     * 执行一次非流式结构化批量翻译。
     *
     * @param input 当前组、组前后句、模式、风格、使用中模型与取消信号。
     * @returns 模型返回的结构化字幕条目；形状非法时由 schema 显式报错。
     */
    public async translate(
        input: LocalSubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]> {
        const schema = createSubtitleBatchResultSchema(input.mode);
        if (SINGLE_SENTENCE_MODEL_IDS.has(input.modelId)) {
            return this.translateSentenceBySentence(input, schema);
        }
        const prompt = buildSubtitleBatchPrompt(input, input.style, { forbidEcho: input.mode === 'zh' });
        const parsed = schema.parse(await this.localAi.generate(
            prompt,
            z.toJSONSchema(schema),
            input.modelId,
            input.signal,
        ));
        if (input.mode === 'zh') {
            this.throwIfEchoed(input.targets, parsed.items, input.mode);
        }
        return parsed.items;
    }

    /**
     * 逐句翻译：每句独立生成，输入当前句及其前后句作只读上下文。
     *
     * 句间邻居优先取同批相邻句，批首尾取调用方传入的组外邻居，
     * 保证每条 prompt 内的字幕都是连续的三句。全部句子并发发出，
     * 依赖 llama-server 多 slot 连续批处理交织解码；并发上限由
     * localAi 信号量（与 slot 数一致）控制，超出部分自动排队。
     * 单句失败（缺键/持续照抄）即整体失败，由调度器的重试路径处理。
     */
    private async translateSentenceBySentence(
        input: LocalSubtitleBatchTranslationInput,
        schema: BatchResultSchema,
    ): Promise<SubtitleTranslationResultItem[]> {
        this.logger.info('本地小模型逐句翻译', {
            modelId: input.modelId,
            sentenceCount: input.targets.length,
        });
        const items = await Promise.all(input.targets.map((target, i) =>
            this.translateSingleSentence(input, schema, target, i)));
        return items;
    }

    /**
     * 翻译单句并做照抄检测。
     *
     * @param input 原始批量输入，用于取邻居上下文、模式与取消信号。
     * @param schema 结构化输出 schema。
     * @param target 当前句。
     * @param i 当前句在组内的下标，决定邻居取同批相邻句还是组外上下文。
     * @returns 当前句的译文；缺键或重试后仍照抄原文则抛错。
     */
    private async translateSingleSentence(
        input: LocalSubtitleBatchTranslationInput,
        schema: BatchResultSchema,
        target: LocalSubtitleBatchTranslationInput['targets'][number],
        i: number,
    ): Promise<SubtitleTranslationResultItem> {
        input.signal.throwIfAborted();
        const contextBefore = i > 0 ? [input.targets[i - 1]] : input.contextBefore;
        const contextAfter = i < input.targets.length - 1 ? [input.targets[i + 1]] : input.contextAfter;
        const prompt = buildSubtitleBatchPrompt({
            targets: [target],
            contextBefore,
            contextAfter,
        }, input.style, { forbidEcho: input.mode === 'zh' });
        // 小模型偶发照抄原文充数：重试一次后仍照抄则显式报错，
        // 交由调度器的批次重试路径处理，不静默用原文充当翻译。
        for (let attempt = 1; attempt <= ECHO_CHECK_MAX_ATTEMPTS; attempt += 1) {
            const parsed = schema.parse(await this.localAi.generate(
                prompt,
                z.toJSONSchema(schema),
                input.modelId,
                input.signal,
            ));
            const candidate = parsed.items.find(
                (item) => item.key === target.key && item.translation.trim().length > 0
            );
            const usable = candidate !== undefined
                && (input.mode !== 'zh' || isUsableZhTranslation(target.text, candidate.translation));
            if (usable) {
                return { key: target.key, translation: candidate.translation.trim() };
            }
            this.logger.warn(candidate ? '本地模型照抄原文，重试' : '本地模型未返回句子译文，重试', {
                sentenceKey: target.key,
                attempt,
            });
        }
        throw new Error(`本地模型未返回句子译文（key=${target.key}）`);
    }

    /**
     * 整批结果的照抄检测：任一句译文与原文相同即显式报错。
     *
     * @param targets 发给模型的目标条目。
     * @param items 模型返回的结构化条目。
     */
    private throwIfEchoed(
        targets: LocalSubtitleBatchTranslationInput['targets'],
        items: SubtitleTranslationResultItem[],
        mode: LocalSubtitleBatchTranslationInput['mode'],
    ): void {
        for (const target of targets) {
            const item = items.find((candidate) => candidate.key === target.key);
            if (item && mode === 'zh' && !isUsableZhTranslation(target.text, item.translation)) {
                throw new Error(`本地模型照抄原文未翻译（sentenceKey=${target.key}）`);
            }
        }
    }
}
