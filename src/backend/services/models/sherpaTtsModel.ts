/** Sherpa-ONNX Piper 英语 TTS 模型的固定安装目录名。 */
export const SHERPA_TTS_MODEL_DIRECTORY = 'vits-piper-en_US-amy-low';

/** Sherpa-ONNX Piper TTS 模型归档的官方下载地址（GitHub Releases，大陆直连极慢）。 */
export const SHERPA_TTS_MODEL_DOWNLOAD_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-low.tar.bz2';

/** Sherpa-ONNX Piper TTS 模型归档的国内镜像地址（项目自建的 ModelScope 仓库，逐字节同上游）。 */
export const SHERPA_TTS_MODEL_MODELSCOPE_URL = 'https://www.modelscope.cn/models/solidSpoon/dashplayer-offline-models/resolve/master/vits-piper-en_US-amy-low.tar.bz2';

/** 有序候选下载地址：ModelScope 镜像优先（国内可直连），GitHub 官方兜底。 */
export const SHERPA_TTS_MODEL_DOWNLOAD_URLS = [
    SHERPA_TTS_MODEL_MODELSCOPE_URL,
    SHERPA_TTS_MODEL_DOWNLOAD_URL,
] as const;

/** 归档文件的 SHA256，下载完成后校验，防止镜像或代理被篡改。 */
export const SHERPA_TTS_MODEL_ARCHIVE_SHA256 = 'c70f5284a09a7fd4ed203b39b2ff51cac1432b422b852eb647b481dade3cf639';

export const SHERPA_TTS_MODEL_ARCHIVE_NAME = 'model.tar.bz2';

/** Sherpa-ONNX Piper TTS 模型运行所需的文件。 */
export const SHERPA_TTS_REQUIRED_FILES = [
    'en_US-amy-low.onnx',
    'tokens.txt',
    'espeak-ng-data',
] as const;
