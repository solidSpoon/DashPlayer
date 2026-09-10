/** 轻量翻译模型单个依赖文件的定义；path 相对模型安装目录。 */
export interface LocalMtModelFile {
    /** 相对模型安装目录的文件路径。 */
    path: string;
    /** 精确字节数，用于续传范围与完整性校验。 */
    bytes: number;
    /** 固定版本的 SHA256。 */
    sha256: string;
}

/**
 * 轻量翻译模型（OPUS-MT en→zh，ONNX 格式）的固定版本目录。
 *
 * encoder 用 int8 量化（-160MB），decoder 保留 fp32——量化版 decoder 实测
 * 会出现严重复读循环，不可用。全部文件经 transformers.js 加载推理。
 */
export const LOCAL_MT_MODEL_ID = 'opus-mt-en-zh';

/**
 * 轻量翻译模型的一个下载源：仓库页面用于手动下载，resolve 基址用于程序化下载
 * （不同源的默认分支名不同：ModelScope 为 master，HuggingFace 为 main）。
 */
export interface LocalMtRepoSource {
    /** 仓库页面地址，手动下载时展示。 */
    pageUrl: string;
    /** 文件下载基址（不含文件名）。 */
    resolveBase: string;
}

/**
 * 有序候选下载源：ModelScope 国内镜像优先，HuggingFace 官方兜底。
 * 两处文件与官方逐字节一致，下载后仍逐个文件经 SHA256 校验。
 */
export const LOCAL_MT_REPO_SOURCES: readonly LocalMtRepoSource[] = [
    {
        pageUrl: 'https://www.modelscope.cn/models/Xenova/opus-mt-en-zh',
        resolveBase: 'https://www.modelscope.cn/models/Xenova/opus-mt-en-zh/resolve/master',
    },
    {
        pageUrl: 'https://huggingface.co/Xenova/opus-mt-en-zh',
        resolveBase: 'https://huggingface.co/Xenova/opus-mt-en-zh/resolve/main',
    },
];

/** 模型全部依赖文件；下载与完整性校验以此清单为准。 */
export const LOCAL_MT_MODEL_FILES: readonly LocalMtModelFile[] = [
    {
        path: 'config.json',
        bytes: 1503,
        sha256: '4727d1229a04f95bf6f39abf949d8080615433d99d6ebd85f81c09edd247d5fa',
    },
    {
        path: 'generation_config.json',
        bytes: 293,
        sha256: 'b743baabb7da4c1a2f19fe558bd6b4c0c7c3b0762fcb5ca7a48fe5a2c2219803',
    },
    {
        path: 'tokenizer.json',
        bytes: 6380952,
        sha256: 'd0c7da27056e8f42adce9e76d8e792e5daa64e15f5acd2e7aabf0121877dd4c1',
    },
    {
        path: 'tokenizer_config.json',
        bytes: 282,
        sha256: 'a914596e6bff113a8428d4793b586da87cd0b95697a0e72aba90cc1d95858481',
    },
    {
        path: 'special_tokens_map.json',
        bytes: 74,
        sha256: '5e4d1f5e759d74cb1c2fe1d165cfc62b5237aa904de759380cd6f43042eec723',
    },
    {
        path: 'source.spm',
        bytes: 806435,
        sha256: '5775ddc9e3ff2fae91554da56468ad35ff56edaba870fea74447bc7234bfdaa8',
    },
    {
        path: 'target.spm',
        bytes: 804600,
        sha256: '81dc94efa84e4025ef38d25d5d07429fe41e3eb29d44003f1db6fe98487b0052',
    },
    {
        path: 'vocab.json',
        bytes: 1747795,
        sha256: '22c957348eed495ee925afc40a36da3e387c8a34a734c8486967c2dca271613e',
    },
    {
        path: 'onnx/encoder_model_quantized.onnx',
        bytes: 52899742,
        sha256: 'd3b7912bf6a9bd27e4c074c2df91d4ff3d5b4bc5f7f6c8d7cc9c805c98fbafee',
    },
    {
        path: 'onnx/decoder_model_merged.onnx',
        bytes: 235839236,
        sha256: '5cb22f9ac32429b8211ae45e5940d9c05dfd66cf5847fd349ac6e391cd671e1d',
    },
] as const;

/** 模型总体积（字节），用于下载进度与展示。 */
export const LOCAL_MT_TOTAL_BYTES =
    LOCAL_MT_MODEL_FILES.reduce((sum, file) => sum + file.bytes, 0);

/** 轻量翻译模型的安装与下载状态；大小单位为字节。 */
export interface LocalMtStatus {
    /** 模型是否已完整安装（全部文件校验通过）。 */
    ready: boolean;
    /** 下载任务阶段。 */
    phase: 'idle' | 'downloading' | 'verifying';
    /** 已下载字节数（跨全部文件累计）。 */
    downloaded: number;
    /** 总字节数。 */
    total: number;
    /** 模型安装目录的绝对路径。 */
    modelPath: string;
    /** 有序候选仓库页面地址（首个为官方，其余为备用镜像），用于网络不佳时手动下载。 */
    downloadUrls: string[];
    /** 最近一次下载失败原因；成功或无记录时为 null。 */
    error: string | null;
}
