/** Sherpa-ONNX Piper 英语 TTS 模型的固定安装目录名。 */
export const SHERPA_TTS_MODEL_DIRECTORY = 'vits-piper-en_US-amy-low';

/** Sherpa-ONNX Piper TTS 模型运行所需的文件。 */
export const SHERPA_TTS_REQUIRED_FILES = [
    'en_US-amy-low.onnx',
    'tokens.txt',
    'espeak-ng-data',
] as const;
