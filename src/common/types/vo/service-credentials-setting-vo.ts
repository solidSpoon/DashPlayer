import type { AiApiFormat } from '@/common/utils/openai-endpoint';

/**
 * 功能占用标识。
 */
export type OpenAiModelUsageFeature = 'sentenceLearning' | 'subtitleTranslation' | 'dictionary';

/**
 * OpenAI 可用模型详情。
 */
export type OpenAiAvailableModelDetailVO = {
    /** 模型标识。 */
    model: string;
    /** 被哪些功能占用。为空表示当前未被任何功能占用。 */
    inUseBy: OpenAiModelUsageFeature[];
};

/**
 * 服务凭据详情值对象。
 */
export type ServiceCredentialSettingDetailVO = {
    openai: {
        /** OpenAI API Key。 */
        key: string;
        /** 云端接口基础地址（不含 /v1 等版本路径）。 */
        endpoint: string;
        /** 版本路径（如 /v1、/v1beta）；为空表示地址已完整、无需拼接。 */
        versionPath: string;
        /** API 兼容格式：openai / anthropic / gemini。 */
        apiFormat: AiApiFormat;
        /** OpenAI 可用模型列表。 */
        models: OpenAiAvailableModelDetailVO[];
    };
    tencent: {
        /** 腾讯云 SecretId。 */
        secretId: string;
        /** 腾讯云 SecretKey。 */
        secretKey: string;
    };
};

/**
 * 服务凭据保存值对象。
 */
export type ServiceCredentialSettingSaveVO = {
    openai: {
        /** OpenAI API Key。 */
        key: string;
        /** 云端接口基础地址（不含 /v1 等版本路径）。 */
        endpoint: string;
        /** 版本路径（如 /v1、/v1beta）；为空表示地址已完整、无需拼接。 */
        versionPath: string;
        /** API 兼容格式：openai / anthropic / gemini。 */
        apiFormat: AiApiFormat;
        /** OpenAI 可用模型标识列表。 */
        models: string[];
    };
    tencent: {
        /** 腾讯云 SecretId。 */
        secretId: string;
        /** 腾讯云 SecretKey。 */
        secretKey: string;
    };
};
