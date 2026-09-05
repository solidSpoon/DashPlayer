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
    /** 固定版本的下载地址。 */
    url: string;
    /** SHA256 校验值。 */
    sha256: string;
}

/** 可下载的本地模型目录，按从小到大排列。 */
export const LOCAL_AI_MODELS: readonly LocalAiModelDefinition[] = [
    {
        id: 'qwen3-0.6b-q4_k_m-v1',
        name: 'Qwen3 0.6B Q4_K_M',
        file: 'Qwen3-0.6B-Q4_K_M.gguf',
        bytes: 396705472,
        sizeLabel: '~397 MB',
        url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf',
        sha256: 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a',
    },
    {
        id: 'qwen3-1.7b-q4_k_m-v1',
        name: 'Qwen3 1.7B Q4_K_M',
        file: 'Qwen3-1.7B-Q4_K_M.gguf',
        bytes: 1107409472,
        sizeLabel: '~1.11 GB',
        url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/d7f544eead698dbd1f15126ef60b45a1e1933222/Qwen3-1.7B-Q4_K_M.gguf',
        sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897',
    },
    {
        id: 'qwen3-4b-q4_k_m-v1',
        name: 'Qwen3 4B Q4_K_M',
        file: 'Qwen3-4B-Q4_K_M.gguf',
        bytes: 2497281312,
        sizeLabel: '~2.5 GB',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/22c9fc8a8c7700b76a1789366280a6a5a1ad1120/Qwen3-4B-Q4_K_M.gguf',
        sha256: 'f6f851777709861056efcdad3af01da38b31223a3ba26e61a4f8bf3a2195813a',
    },
] as const;

/** 本地模型设置键的默认取值。 */
export const LOCAL_AI_DEFAULT_MODEL_ID = 'qwen3-1.7b-q4_k_m-v1';

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
    /** 模型标识，与目录项 id 一致。 */
    modelId: string;
    /** 展示名。 */
    name: string;
    /** 展示用大小标签。 */
    sizeLabel: string;
    /** 是否已完整安装。 */
    ready: boolean;
    /** 下载任务阶段。 */
    phase: 'idle' | 'downloading' | 'verifying';
    /** 已下载字节数。 */
    downloaded: number;
    /** 总字节数。 */
    total: number;
    /** 安装后的完整文件路径。 */
    modelPath: string;
    /** 固定版本的下载地址。 */
    downloadUrl: string;
    /** 最近一次下载失败原因；成功或无记录时为 null。 */
    error: string | null;
}

/** 本地模型管理页状态；大小单位为字节。 */
export interface LocalAiStatus {
    /** llama-server 运行时是否就绪。 */
    runtimeReady: boolean;
    /** 推理子进程是否在运行。 */
    running: boolean;
    /** 全部本地功能当前共用的模型标识。 */
    activeModelId: string;
    /** 按目录顺序列出全部模型，无论是否已安装。 */
    models: LocalAiModelStatus[];
}
