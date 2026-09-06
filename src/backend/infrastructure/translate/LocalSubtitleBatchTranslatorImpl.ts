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
 * 这些模型整批翻译时偶发条目错乱（多给/漏给/带出上下文键），
 * 甚至输出循环顶满 max_tokens（正式日志 expected=5 actual=7、
 * finish_reason=length 均来自 0.8B）；更大的模型无此问题。
 */
const SINGLE_SENTENCE_MODEL_IDS = new Set(['qwen3.5-0.8b-q4_k_m']);

type BatchResultSchema = ReturnType<typeof createSubtitleBatchResultSchema>;

/**
 * 本地字幕批量翻译网关：自持提示词拼装与 GGUF 结构化输出。
 *
 * 推理进程、模型加载与请求超时都由 LocalAiRuntime 管理；这里负责把语义输入
 * 拼成本地模型可执行的提示词，并校验输出形状。本地模型特有的容错策略
 * （如小模型逐句降级）也落在本实现内，业务层不感知。
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
        const prompt = buildSubtitleBatchPrompt(input, input.style);
        return schema.parse(await this.localAi.generate(
            prompt,
            z.toJSONSchema(schema),
            input.modelId,
            input.signal,
        )).items;
    }

    /**
     * 逐句翻译：每次只翻一句，输入当前句及其前后句作只读上下文。
     *
     * 句间邻居优先取同批相邻句，批首尾取调用方传入的组外邻居，
     * 保证每条 prompt 内的字幕都是连续的三句。任意一句失败即整体失败，
     * 由调度器的重试路径处理；单句请求下模型偶发带出上下文键或多条结果，
     * 只认当前句的键，缺失即显式报错。
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
            }, input.style);
            const parsed = schema.parse(await this.localAi.generate(
                prompt,
                z.toJSONSchema(schema),
                input.modelId,
                input.signal,
            ));
            const matched = parsed.items.find((item) => item.key === target.key && item.translation.trim().length > 0);
            if (!matched) {
                throw new Error(`本地模型未返回句子译文（key=${target.key}）`);
            }
            items.push({ key: target.key, translation: matched.translation.trim() });
        }
        return items;
    }
}
