/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型（q8_0 量化）的固定安装目录名。 */
export const WHISPER_CPP_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-q8_0-gguf';
/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型官方单文件下载地址（HuggingFace 直链）。 */
export const WHISPER_CPP_MODEL_DOWNLOAD_URL = 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/**
 * whisper.cpp 模型的国内备用镜像地址（hf-mirror.com 是 HuggingFace 的逐字节镜像，
 * 路径结构与官方一致，仅替换域名），供官方直链不可达（如大陆网络）时自动回退。
 */
export const WHISPER_CPP_MODEL_MIRROR_URL = 'https://hf-mirror.com/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/** whisper.cpp 模型的有序候选下载地址：官方优先，镜像兜底。 */
export const WHISPER_CPP_MODEL_DOWNLOAD_URLS = [
    WHISPER_CPP_MODEL_DOWNLOAD_URL,
    WHISPER_CPP_MODEL_MIRROR_URL,
] as const;
/** whisper.cpp 引擎使用的 GGUF 模型归档文件名（单文件形态，归档即模型文件）。 */
export const WHISPER_CPP_MODEL_ARCHIVE_NAME = 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/** whisper.cpp 引擎完整运行所需的模型文件。 */
export const WHISPER_CPP_REQUIRED_FILES = [
    WHISPER_CPP_MODEL_ARCHIVE_NAME,
] as const;
