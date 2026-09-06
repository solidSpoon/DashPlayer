/** 本地模型目录项；id 同时作为设置值、安装目录名与缓存隔离键的一部分。 */
export interface LocalAiModelDefinition {
    /** 稳定模型标识，目录内唯一。 */
    id: string;
    /** 展示名。 */
    name: string;
    /** 模型 GGUF 文件名。 */
    file: string;
    /** 精确字节数，用于续传范围与完整性校验。 */
    bytes: number;
    /** 展示用大小标签。 */
    sizeLabel: string;
    /** 固定版本的下载地址；自定义模型无下载源。 */
    url: string;
    /** 固定版本的 SHA256；自定义模型留空。 */
    sha256: string;
    /** 模型来源：catalog 由应用目录预置，custom 为用户手动放入模型目录的文件。 */
    source: 'catalog' | 'custom';
}

/** 可下载的本地模型目录；同一家族保证提示词与推理参数行为一致。 */
export const LOCAL_AI_MODELS: readonly LocalAiModelDefinition[] = [
    {
        id: 'qwen3.5-2b-q4_k_m',
        name: 'Qwen3.5 2B Q4_K_M',
        file: 'Qwen3.5-2B-Q4_K_M.gguf',
        bytes: 1280835840,
        sizeLabel: '~1.28 GB',
        url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
        sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
        source: 'catalog',
    },
] as const;

/** 本地模型设置键的默认取值；选择官方目录中翻译质量与体积平衡最好的一档。 */
export const LOCAL_AI_DEFAULT_MODEL_ID = 'qwen3.5-2b-q4_k_m';

/** 自定义模型 id 的固定前缀；后缀为模型目录根下的 GGUF 文件名。 */
export const CUSTOM_MODEL_ID_PREFIX = 'custom:';

/** 判断模型 id 是否指向用户手动放入的自定义模型。 */
export function isCustomModelId(modelId: string): boolean {
    return modelId.startsWith(CUSTOM_MODEL_ID_PREFIX);
}

/**
 * 按稳定 id 查找目录项。
 *
 * @param modelId 待查找的模型标识。
 * @returns 对应目录项；不存在时抛出显式错误，不做默认回退。
 */
export function requireLocalAiModel(modelId: string): LocalAiModelDefinition {
    const found = LOCAL_AI_MODELS.find((model) => model.id === modelId);
    if (!found) {
        throw new Error(`未知的本地模型：${modelId}`);
    }
    return found;
}

/** 单个本地模型的安装与下载状态；大小单位为字节。 */
export interface LocalAiModelStatus {
    /** 模型标识，目录模型与目录一致，自定义模型带 custom: 前缀。 */
    modelId: string;
    /** 展示名。 */
    name: string;
    /** 模型 GGUF 文件名。 */
    file: string;
    /** 精确字节数，用于续传范围与完整性校验。 */
    bytes: number;
    /** 展示用大小标签。 */
    sizeLabel: string;
    /** 运行时内存估算值（GB，保留一位小数），按模型体积约 1.5 倍估算（权重 + KV cache + 推理缓冲）；文案由前端按语言格式化。 */
    memoryEstimateGb: string;
    /** 是否已完整安装。 */
    ready: boolean;
    /** 下载任务阶段；自定义模型恒为 idle。 */
    phase: 'idle' | 'downloading' | 'verifying';
    /** 已下载字节数。 */
    downloaded: number;
    /** 总字节数。 */
    total: number;
    /** 固定版本的模型安装路径。 */
    modelPath: string;
    /** 固定版本的下载地址；自定义模型为 null。 */
    downloadUrl: string | null;
    /** 最近一次下载失败原因；成功或无记录时为 null。 */
    error: string | null;
    /** 是否为用户手动放入模型目录的自定义模型。 */
    custom: boolean;
}

/** 本地模型速度测试结果；时长单位毫秒，token 数据由推理端提供，缺失时为 null。 */
export interface LocalAiSpeedTestResult {
    /** 模型冷加载耗时（含进程启动到健康检查通过）；测速前会先释放已加载模型。 */
    loadMs: number;
    /** 首轮生成耗时，含推理初始化（如 Vulkan shader 编译）。 */
    firstMs: number;
    /** 热身后第二轮生成耗时。 */
    warmMs: number;
    /** 提示词 token 数。 */
    promptTokens: number | null;
    /** 生成 token 数。 */
    completionTokens: number | null;
    /** 热身轮生成速度（token/秒）。 */
    tokensPerSecond: number | null;
}

/** 本地模型管理页状态；大小单位为字节。 */
export interface LocalAiStatus {
    /** llama-server 运行时是否就绪。 */
    runtimeReady: boolean;
    /** 推理子进程是否在运行。 */
    running: boolean;
    /** 全部本地功能当前共用的模型标识。 */
    activeModelId: string;
    /** 模型根目录的绝对路径；用户手动放置 GGUF 文件的目标位置。 */
    modelsDirectory: string;
    /** 按目录顺序列出目录模型，末尾追加用户手动放入的自定义模型。 */
    models: LocalAiModelStatus[];
}
