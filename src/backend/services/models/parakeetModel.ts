/** Parakeet v3 模型的固定安装目录名。 */
export const PARAKEET_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-int8';

/** Parakeet v3 模型归档的官方下载地址（GitHub Releases，大陆直连极慢）。 */
export const PARAKEET_MODEL_DOWNLOAD_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';

/** Parakeet v3 模型归档的国内镜像地址（项目自建的 ModelScope 仓库，逐字节同上游）。 */
export const PARAKEET_MODEL_MODELSCOPE_URL = 'https://www.modelscope.cn/models/solidSpoon/dashplayer-offline-models/resolve/master/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';

/** 有序候选下载地址：ModelScope 镜像优先（国内可直连），GitHub 官方兜底。 */
export const PARAKEET_MODEL_DOWNLOAD_URLS = [
    PARAKEET_MODEL_MODELSCOPE_URL,
    PARAKEET_MODEL_DOWNLOAD_URL,
] as const;

/** 归档文件的 SHA256，下载完成后校验，防止镜像或代理被篡改。 */
export const PARAKEET_MODEL_ARCHIVE_SHA256 = '5793d0fd397c5778d2cf2126994d58e9d56b1be7c04d13c7a15bb1b4eafb16bf';

export const PARAKEET_MODEL_ARCHIVE_NAME = 'model.tar.bz2';

/** Parakeet v3 完整运行所需的模型文件。 */
export const PARAKEET_REQUIRED_FILES = [
    'encoder.int8.onnx',
    'decoder.int8.onnx',
    'joiner.int8.onnx',
    'tokens.txt',
] as const;
