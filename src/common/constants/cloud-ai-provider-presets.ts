import { AiApiFormat } from '@/common/utils/cloud-ai-api-format';

/**
 * 云端 AI 厂商预设模板。
 *
 * 集中维护国内（及国外常见）厂商的接入参数，用户在「服务与资源」设置页
 * 通过「使用预设」弹窗选择后自动填入接口地址与 API 类型，用户只需再填写
 * API Key 与模型；厂商名视为专有名词，不做 i18n。
 */

/** 单个厂商预设。 */
export interface CloudAiProviderPreset {
    /** 预设唯一标识。 */
    id: string;
    /** 厂商显示名。 */
    name: string;
    /** API 兼容格式。 */
    apiFormat: AiApiFormat;
    /** 云端接口完整 base URL（含 /v1 等版本路径）。 */
    endpoint: string;
    /** 控制台网址，用于申请 API Key。 */
    consoleUrl: string;
}

/**
 * 厂商预设列表；国内厂商在前，国外常见厂商在后。
 *
 * 各端点以厂商公开文档为准；模型迭代较快，预设只预填接入参数不预填模型。
 */
export const CLOUD_AI_PROVIDER_PRESETS: CloudAiProviderPreset[] = [
    {
        id: 'deepseek',
        name: 'DeepSeek',
        apiFormat: 'openai',
        endpoint: 'https://api.deepseek.com/v1',
        consoleUrl: 'https://platform.deepseek.com',
    },
    {
        id: 'zhipu-glm',
        name: '智谱 GLM',
        apiFormat: 'openai',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        consoleUrl: 'https://open.bigmodel.cn',
    },
    {
        id: 'aliyun-bailian',
        name: '阿里云百炼',
        apiFormat: 'openai',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        consoleUrl: 'https://bailian.console.aliyun.com',
    },
    {
        id: 'volcengine-ark',
        name: '火山引擎方舟',
        apiFormat: 'openai',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
        consoleUrl: 'https://console.volcengine.com/ark',
    },
    {
        id: 'moonshot-kimi',
        name: '月之暗面 Kimi',
        apiFormat: 'openai',
        endpoint: 'https://api.moonshot.cn/v1',
        consoleUrl: 'https://platform.moonshot.cn',
    },
    {
        id: 'tencent-hunyuan',
        name: '腾讯混元',
        apiFormat: 'openai',
        endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
        consoleUrl: 'https://cloud.tencent.com/product/hunyuan',
    },
    {
        id: 'siliconflow',
        name: '硅基流动',
        apiFormat: 'openai',
        endpoint: 'https://api.siliconflow.cn/v1',
        consoleUrl: 'https://cloud.siliconflow.cn',
    },
    {
        id: 'minimax',
        name: 'MiniMax',
        apiFormat: 'openai',
        endpoint: 'https://api.minimax.chat/v1',
        consoleUrl: 'https://platform.minimaxi.com',
    },
    {
        id: 'xfyun-spark',
        name: '讯飞星火',
        apiFormat: 'openai',
        endpoint: 'https://spark-api-open.xf-yun.com/v1',
        consoleUrl: 'https://xinghuo.xfyun.cn',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        apiFormat: 'openai',
        endpoint: 'https://api.openai.com/v1',
        consoleUrl: 'https://platform.openai.com',
    },
    {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        apiFormat: 'anthropic',
        endpoint: 'https://api.anthropic.com/v1',
        consoleUrl: 'https://console.anthropic.com',
    },
    {
        id: 'google-gemini',
        name: 'Google Gemini',
        apiFormat: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        consoleUrl: 'https://aistudio.google.com',
    },
];
