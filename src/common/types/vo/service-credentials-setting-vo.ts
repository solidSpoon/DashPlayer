import type { AiApiFormat } from '@/common/utils/cloud-ai-api-format';

/**
 * 服务凭据详情值对象。
 *
 * 模型列表只含标识：占用是引擎选择推导出的事实，由前端用
 * computeCloudModelUsage 按当前表单值现算展示，不随详情快照下发（否则
 * 引擎切换后角标不会跟着变）。
 */
export type ServiceCredentialSettingDetailVO = {
    openai: {
        /** OpenAI API Key。 */
        key: string;
        /** 云端接口完整 base URL（含 /v1 等版本路径）。 */
        endpoint: string;
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

/**
 * 服务凭据保存值对象。
 */
export type ServiceCredentialSettingSaveVO = {
    openai: {
        /** OpenAI API Key。 */
        key: string;
        /** 云端接口完整 base URL（含 /v1 等版本路径）。 */
        endpoint: string;
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
