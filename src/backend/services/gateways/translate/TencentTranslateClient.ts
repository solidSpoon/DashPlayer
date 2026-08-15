import TransHolder from '@/common/utils/TransHolder';

/**
 * 腾讯字幕批次的日志关联字段。
 */
export interface TencentTranslateBatchLogContext {
    /** 字幕翻译批次编号。 */
    batchId?: string;
    /** 字幕文件哈希。 */
    fileHash?: string;
}

export interface TencentTranslateClient {
    /**
     * 批量翻译文本，并返回原文到译文的映射。
     *
     * @param source 待翻译文本。
     * @param logContext 可选的字幕批次日志关联字段。
     * @returns 原文到译文的映射。
     */
    batchTrans(
        source: string[],
        logContext?: TencentTranslateBatchLogContext
    ): Promise<TransHolder<string>>;
}
