/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型（q8_0 量化）的固定安装目录名。 */
export const WHISPER_CPP_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-q8_0-gguf';
/** whisper.cpp 引擎使用的 Parakeet v3 GGUF 模型单文件下载地址。 */
export const WHISPER_CPP_MODEL_DOWNLOAD_URL = 'https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin';
/** whisper.cpp 引擎使用的 GGUF 模型归档文件名（单文件形态，归档即模型文件）。 */
export const WHISPER_CPP_MODEL_ARCHIVE_NAME = 'ggml-parakeet-tdt-0.6b-v3-q8_0.bin';

/** whisper.cpp 引擎完整运行所需的模型文件。 */
export const WHISPER_CPP_REQUIRED_FILES = [
    WHISPER_CPP_MODEL_ARCHIVE_NAME,
] as const;
