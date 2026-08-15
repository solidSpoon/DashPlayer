/**
 * OpenAI 字幕翻译目标条目。
 */
export interface OpenAiSubtitleTranslationTarget {
    /** 必须原样返回的稳定字幕键。 */
    key: string;
    /** 待翻译的字幕原文。 */
    text: string;
}

/**
 * OpenAI 字幕翻译网关请求。
 */
export interface OpenAiSubtitleTranslationRequest {
    /** 已拼装完成的批量字幕提示词。 */
    prompt: string;
    /** 结构化输出中 translation 字段的语义说明。 */
    translationDescription: string;
    /** 用于取消跳转后过期请求的信号。 */
    signal: AbortSignal;
}

/**
 * OpenAI 字幕翻译网关返回条目。
 */
export interface OpenAiSubtitleTranslationResultItem {
    /** 模型返回的字幕键。 */
    key: string;
    /** 模型返回的翻译文本。 */
    translation: string;
}

/**
 * 隔离 AI SDK 与具体模型调用的字幕翻译网关。
 */
export default interface OpenAiSubtitleTranslationGateway {
    /**
     * 执行一次非流式结构化字幕翻译。
     *
     * @param request 提示词、字段说明与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    translate(
        request: OpenAiSubtitleTranslationRequest
    ): Promise<OpenAiSubtitleTranslationResultItem[]>;
}
