import {
    SubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';

/**
 * 云端引擎的字幕批量翻译网关。
 *
 * 自持提示词拼装与 OpenAI 兼容结构化输出的调用细节；业务层只提供语义输入。
 */
export default interface OpenAiSubtitleBatchTranslator {
    /**
     * 执行一次非流式结构化批量翻译。
     *
     * @param input 当前组、组前后句、模式、风格与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    translate(
        input: SubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]>;
}
