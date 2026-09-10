/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型（q8_0 量化）的固定安装目录名。 */
export const WHISPER_CPP_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-q8_0-gguf';
/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型官方单文件下载地址（HuggingFace 直链）。 */
export const WHISPER_CPP_MODEL_DOWNLOAD_URL = 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/**
 * 国内优先镜像（ModelScope 的 ggml-org/parakeet-GGUF 仓库，与官方逐字节一致），
 * 大陆可直连，作为第一候选。
 */
export const WHISPER_CPP_MODEL_MODELSCOPE_URL = 'https://www.modelscope.cn/models/ggml-org/parakeet-GGUF/resolve/master/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/**
 * HuggingFace 的国内备用镜像（hf-mirror.com 按地区分流：大陆 IP 自行服务，其余转官方），
 * 作为官方直链不可达时的第三候选。
 */
export const WHISPER_CPP_MODEL_MIRROR_URL = 'https://hf-mirror.com/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/** whisper.cpp 模型的有序候选下载地址：ModelScope 优先，官方其次，hf-mirror 兜底。 */
export const WHISPER_CPP_MODEL_DOWNLOAD_URLS = [
    WHISPER_CPP_MODEL_MODELSCOPE_URL,
    WHISPER_CPP_MODEL_DOWNLOAD_URL,
    WHISPER_CPP_MODEL_MIRROR_URL,
] as const;
/** whisper.cpp 引擎使用的 GGUF 模型归档文件名（单文件形态，归档即模型文件）。 */
export const WHISPER_CPP_MODEL_ARCHIVE_NAME = 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/** whisper.cpp 引擎完整运行所需的模型文件。 */
export const WHISPER_CPP_REQUIRED_FILES = [
    WHISPER_CPP_MODEL_ARCHIVE_NAME,
] as const;
