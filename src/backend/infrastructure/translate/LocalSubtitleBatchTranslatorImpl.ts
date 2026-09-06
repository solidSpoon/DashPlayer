import { inject, injectable } from 'inversify';
import { z } from 'zod';
import TYPES from '@/backend/ioc/types';
import type LocalAiService from '@/backend/services/LocalAiService';
import LocalSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalSubtitleBatchTranslator';
import { LocalSubtitleBatchTranslationInput, SubtitleTranslationResultItem } from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';
import {
    buildSubtitleBatchPrompt,
    createSubtitleBatchResultSchema,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';

/**
 * 本地字幕批量翻译网关：自持提示词拼装与 GGUF 结构化输出。
 *
 * 推理进程、模型加载与请求超时都由 LocalAiRuntime 管理；这里负责把语义输入
 * 拼成本地模型可执行的提示词，并校验输出形状。本地模型特有的容错策略
 * （如整批失败后的降级重试）后续也落在本实现内，业务层不感知。
 */
@injectable()
export default class LocalSubtitleBatchTranslatorImpl
implements LocalSubtitleBatchTranslator {
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
        const prompt = buildSubtitleBatchPrompt(input, input.style);

        return schema.parse(await this.localAi.generate(
            prompt,
            z.toJSONSchema(schema),
            input.modelId,
            input.signal,
        )).items;
    }
}
