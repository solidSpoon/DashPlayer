import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import type LocalMtService from '@/backend/services/LocalMtService';
import LocalMtSubtitleBatchTranslator from '@/backend/services/gateways/translate/LocalMtSubtitleBatchTranslator';
import {
    SubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';

/**
 * 轻量翻译引擎字幕批量翻译网关：专用 en→zh 模型逐句翻译，按序对齐。
 *
 * 模型加载与推理串行由 LocalMtRuntime 管理；这里只做语义输入的形状转换。
 * 专用模型不消费风格与上下文，也不需要模型回抄键——key 由本地按序回填，
 * 从根本上消除了 LLM 链路的「键回抄失败/照抄原文」两类重试面。
 */
@injectable()
export default class LocalMtSubtitleBatchTranslatorImpl
implements LocalMtSubtitleBatchTranslator {
    /** 注入轻量翻译服务。 */
    public constructor(
        @inject(TYPES.LocalMtService) private readonly localMt: LocalMtService,
    ) {}

    /**
     * 执行一次批量翻译。
     *
     * @param input 当前组与取消信号；仅使用 targets 与 signal。
     * @returns 按目标顺序对齐的结构化字幕条目。
     */
    public async translate(
        input: SubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]> {
        const translations = await this.localMt.translateLines(
            input.targets.map((target) => target.text),
            input.signal,
        );
        return input.targets.map((target, index) => ({
            key: target.key,
            translation: translations[index],
        }));
    }
}
