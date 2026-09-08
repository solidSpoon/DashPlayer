import {
    SubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';

/**
 * 轻量翻译引擎的字幕批量翻译网关。
 *
 * 与 LLM 网关不同：模型是专用 en→zh 翻译模型，不支持风格/上下文/键回抄，
 * 译文直接按目标顺序对齐返回。仅支持中文模式。
 */
export default interface LocalMtSubtitleBatchTranslator {
    /**
     * 批量翻译一批字幕行。
     *
     * @param input 当前组与取消信号；contextBefore/contextAfter/style 会被忽略。
     * @returns 按目标顺序对齐的结构化字幕条目（key 原样回填）。
     */
    translate(input: SubtitleBatchTranslationInput): Promise<SubtitleTranslationResultItem[]>;
}
