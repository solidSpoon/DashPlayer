import { AiApiFormat } from '@/common/utils/openai-endpoint';

/**
 * 云端 AI 厂商预设模板。
 *
 * 集中维护国内（及国外常见）厂商的接入参数，用户在「服务与资源」设置页
 * 下拉选择预设后只需填写 API Key；厂商名视为专有名词，不做 i18n。
 */

/** 单个厂商预设。 */
export interface CloudAiProviderPreset {
    /** 预设唯一标识。 */
    id: string;
    /** 厂商显示名。 */
    name: string;
    /** API 兼容格式。 */
    apiFormat: AiApiFormat;
    /**
     * 接口地址（不含版本路径；开启 autoAppendV1 时由端点解析自动补
     * /v1（openai/anthropic）或 /v1beta（gemini））。
     */
    endpoint: string;
    /** 是否自动追加版本路径。 */
    autoAppendV1: boolean;
    /** 控制台网址，用于申请 API Key。 */
    consoleUrl: string;
    /** 常用模型标识；选预设时合并进可用模型列表（已存在的跳过）。 */
    models: string[];
}

/**
 * 厂商预设列表；国内厂商在前，国外常见厂商在后。
 *
 * 各端点与模型标识以厂商公开文档为准，模型迭代较快，预设值仅作起点，
 * 用户可自行增删。
 */
export const CLOUD_AI_PROVIDER_PRESETS: CloudAiProviderPreset[] = [
    {
        id: 'deepseek',
        name: 'DeepSeek',
        apiFormat: 'openai',
        endpoint: 'https://api.deepseek.com',
        autoAppendV1: true,
        consoleUrl: 'https://platform.deepseek.com',
        models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
        id: 'zhipu-glm',
        name: '智谱 GLM',
        apiFormat: 'openai',
        endpoint: 'https://open.bigmodel.cn/api/paas/v4',
        autoAppendV1: false,
        consoleUrl: 'https://open.bigmodel.cn',
        models: ['glm-4.6', 'glm-4.5-air'],
    },
    {
        id: 'aliyun-bailian',
        name: '阿里云百炼',
        apiFormat: 'openai',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        autoAppendV1: false,
        consoleUrl: 'https://bailian.console.aliyun.com',
        models: ['qwen-plus', 'qwen-max'],
    },
    {
        id: 'volcengine-ark',
        name: '火山引擎方舟',
        apiFormat: 'openai',
        endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
        autoAppendV1: false,
        consoleUrl: 'https://console.volcengine.com/ark',
        models: ['doubao-seed-1-6-250615'],
    },
    {
        id: 'moonshot-kimi',
        name: '月之暗面 Kimi',
        apiFormat: 'openai',
        endpoint: 'https://api.moonshot.cn/v1',
        autoAppendV1: false,
        consoleUrl: 'https://platform.moonshot.cn',
        models: ['kimi-k2-0711-preview', 'moonshot-v1-8k'],
    },
    {
        id: 'tencent-hunyuan',
        name: '腾讯混元',
        apiFormat: 'openai',
        endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
        autoAppendV1: false,
        consoleUrl: 'https://cloud.tencent.com/product/hunyuan',
        models: ['hunyuan-lite'],
    },
    {
        id: 'siliconflow',
        name: '硅基流动',
        apiFormat: 'openai',
        endpoint: 'https://api.siliconflow.cn/v1',
        autoAppendV1: false,
        consoleUrl: 'https://cloud.siliconflow.cn',
        models: ['deepseek-ai/DeepSeek-V3'],
    },
    {
        id: 'minimax',
        name: 'MiniMax',
        apiFormat: 'openai',
        endpoint: 'https://api.minimax.chat/v1',
        autoAppendV1: false,
        consoleUrl: 'https://platform.minimaxi.com',
        models: ['MiniMax-M2'],
    },
    {
        id: 'xfyun-spark',
        name: '讯飞星火',
        apiFormat: 'openai',
        endpoint: 'https://spark-api-open.xf-yun.com/v1',
        autoAppendV1: false,
        consoleUrl: 'https://xinghuo.xfyun.cn',
        models: ['generalv3.5'],
    },
    {
        id: 'openai',
        name: 'OpenAI',
        apiFormat: 'openai',
        endpoint: 'https://api.openai.com',
        autoAppendV1: true,
        consoleUrl: 'https://platform.openai.com',
        models: ['gpt-4o-mini'],
    },
    {
        id: 'anthropic',
        name: 'Claude (Anthropic)',
        apiFormat: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        autoAppendV1: true,
        consoleUrl: 'https://console.anthropic.com',
        models: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    },
    {
        id: 'google-gemini',
        name: 'Google Gemini',
        apiFormat: 'gemini',
        endpoint: 'https://generativelanguage.googleapis.com',
        autoAppendV1: true,
        consoleUrl: 'https://aistudio.google.com',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    },
];

/**
 * 按接入参数反查匹配的预设。
 *
 * 接口地址、API 格式与追加开关三者都与预设一致时视为命中；否则返回 null，
 * 前端显示为「自定义」。
 *
 * @param endpoint 用户配置的接口地址。
 * @param apiFormat 用户配置的 API 格式。
 * @param autoAppendV1 是否自动追加版本路径。
 * @returns 命中的预设或 null。
 */
export const matchCloudAiProviderPreset = (
    endpoint: string,
    apiFormat: string,
    autoAppendV1: boolean,
): CloudAiProviderPreset | null => {
    return CLOUD_AI_PROVIDER_PRESETS.find((preset) => preset.endpoint === endpoint
        && preset.apiFormat === apiFormat
        && preset.autoAppendV1 === autoAppendV1) ?? null;
};
