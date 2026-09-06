import {
    LocalSubtitleBatchTranslationInput,
    SubtitleTranslationResultItem,
} from '@/backend/services/gateways/translate/SubtitleBatchTranslationInput';

/**
 * 本地引擎的字幕批量翻译网关。
 *
 * 自持提示词拼装、GGUF 结构化输出的调用细节与本地特有的容错策略；
 * 业务层只提供语义输入，不感知本地模型的提示词与输出修复方式。
 */
export default interface LocalSubtitleBatchTranslator {
    /**
     * 执行一次非流式结构化批量翻译。
     *
     * @param input 当前组、组前后句、模式、风格、使用中模型与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    translate(
        input: LocalSubtitleBatchTranslationInput
    ): Promise<SubtitleTranslationResultItem[]>;
}
