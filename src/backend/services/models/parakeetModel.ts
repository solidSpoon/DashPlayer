/** Parakeet v3 模型的固定安装目录名。 */
export const PARAKEET_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-int8';
export const PARAKEET_MODEL_DOWNLOAD_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';
export const PARAKEET_MODEL_ARCHIVE_NAME = 'model.tar.bz2';

/** Parakeet v3 完整运行所需的模型文件。 */
export const PARAKEET_REQUIRED_FILES = [
    'encoder.int8.onnx',
    'decoder.int8.onnx',
    'joiner.int8.onnx',
    'tokens.txt',
] as const;
