/** Parakeet v3 模型的固定安装目录名。 */
export const PARAKEET_MODEL_DIRECTORY = 'parakeet-tdt-0.6b-v3-int8';

/** Parakeet v3 完整运行所需的模型文件。 */
export const PARAKEET_REQUIRED_FILES = [
    'encoder.int8.onnx',
    'decoder.int8.onnx',
    'joiner.int8.onnx',
    'tokens.txt',
] as const;
