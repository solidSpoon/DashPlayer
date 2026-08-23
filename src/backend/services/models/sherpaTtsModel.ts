/** Sherpa-ONNX Piper 英语 TTS 模型的固定安装目录名。 */
export const SHERPA_TTS_MODEL_DIRECTORY = 'vits-piper-en_US-amy-low';
export const SHERPA_TTS_MODEL_DOWNLOAD_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-low.tar.bz2';
export const SHERPA_TTS_MODEL_ARCHIVE_NAME = 'model.tar.bz2';

/** Sherpa-ONNX Piper TTS 模型运行所需的文件。 */
export const SHERPA_TTS_REQUIRED_FILES = [
    'en_US-amy-low.onnx',
    'tokens.txt',
    'espeak-ng-data',
] as const;
