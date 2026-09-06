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
 * 照抄检测前对文本做的归一化：去首尾空白、压缩连续空白、忽略大小写。
 */
const normalizeForEchoCheck = (text: string): string =>
    text.replace(/\s+/g, ' ').trim().toLowerCase();

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
            this.throwIfEchoed(input.targets, parsed.items);
        }
        return parsed.items;
    }

    /**
     * 逐句翻译：每次只翻一句，输入当前句及其前后句作只读上下文。
     *
     * 句间邻居优先取同批相邻句，批首尾取调用方传入的组外邻居，
     * 保证每条 prompt 内的字幕都是连续的三句。任意一句失败即整体失败，
     * 由调度器的重试路径处理；单句响应若缺失当前句的键，显式报错。
     */
    private async translateSentenceBySentence(
        input: LocalSubtitleBatchTranslationInput,
        schema: BatchResultSchema,
    ): Promise<SubtitleTranslationResultItem[]> {
        this.logger.info('本地小模型逐句翻译', {
            modelId: input.modelId,
            sentenceCount: input.targets.length,
        });
        const items: SubtitleTranslationResultItem[] = [];
        for (let i = 0; i < input.targets.length; i += 1) {
            input.signal.throwIfAborted();
            const target = input.targets[i];
            const contextBefore = i > 0 ? [input.targets[i - 1]] : input.contextBefore;
            const contextAfter = i < input.targets.length - 1 ? [input.targets[i + 1]] : input.contextAfter;
            const prompt = buildSubtitleBatchPrompt({
                targets: [target],
                contextBefore,
                contextAfter,
            }, input.style, { forbidEcho: input.mode === 'zh' });
            let matched: SubtitleTranslationResultItem | undefined;
            // 小模型偶发照抄原文充数：重试一次后仍照抄则显式报错，
            // 交由调度器的批次重试路径处理，不静默用原文充当翻译。
            for (let attempt = 1; attempt <= ECHO_CHECK_MAX_ATTEMPTS && !matched; attempt += 1) {
                const parsed = schema.parse(await this.localAi.generate(
                    prompt,
                    z.toJSONSchema(schema),
                    input.modelId,
                    input.signal,
                ));
                const candidate = parsed.items.find(
                    (item) => item.key === target.key && item.translation.trim().length > 0
                );
                if (!candidate) {
                    break;
                }
                if (input.mode === 'zh'
                    && normalizeForEchoCheck(candidate.translation) === normalizeForEchoCheck(target.text)) {
                    this.logger.warn('本地模型照抄原文，重试', {
                        key: target.key,
                        attempt,
                    });
                    continue;
                }
                matched = { key: target.key, translation: candidate.translation.trim() };
            }
            if (!matched) {
                throw new Error(`本地模型未返回句子译文（key=${target.key}）`);
            }
            items.push(matched);
        }
        return items;
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
    ): void {
        for (const target of targets) {
            const item = items.find((candidate) => candidate.key === target.key);
            if (item
                && normalizeForEchoCheck(item.translation) === normalizeForEchoCheck(target.text)) {
                throw new Error(`本地模型照抄原文未翻译（key=${target.key}）`);
            }
        }
    }
}
