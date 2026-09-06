/** 网关请求的引擎路径；由调用方按已解析的设置显式指定，网关自身不读取设置。 */
export type SubtitleTranslationEnginePath =
    | { kind: 'openai' }
    | { kind: 'local'; /** 本地推理使用的模型 id，必须来自本地模型目录。 */ modelId: string };

/**
 * 字幕翻译网关目标条目。
 */
export interface SubtitleTranslationTarget {
    /** 必须原样返回的稳定字幕键。 */
    key: string;
    /** 待翻译的字幕原文。 */
    text: string;
}

/**
 * 字幕翻译网关请求。
 */
export interface SubtitleTranslationGatewayRequest {
    /** 已拼装完成的批量字幕提示词。 */
    prompt: string;
    /** 结构化输出中 translation 字段的语义说明。 */
    translationDescription: string;
    /** 本次翻译使用的引擎与模型；与缓存键的解析结果同源，避免两处读取设置产生不一致。 */
    engine: SubtitleTranslationEnginePath;
    /** 用于取消跳转后过期请求的信号。 */
    signal: AbortSignal;
}

/**
 * 字幕翻译网关返回条目。
 */
export interface SubtitleTranslationResultItem {
    /** 模型返回的字幕键。 */
    key: string;
    /** 模型返回的翻译文本。 */
    translation: string;
}

/**
 * 隔离具体翻译引擎（云端 OpenAI 兼容模型 / 本地 GGUF 推理）与调度层的字幕翻译网关。
 */
export default interface SubtitleTranslationGateway {
    /**
     * 执行一次非流式结构化字幕翻译。
     *
     * @param request 提示词、字段说明、引擎路径与取消信号。
     * @returns 模型返回的结构化字幕条目。
     */
    translate(
        request: SubtitleTranslationGatewayRequest
    ): Promise<SubtitleTranslationResultItem[]>;
}
