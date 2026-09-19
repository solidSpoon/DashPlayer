/** Orukeet 固定版本的官方 Hugging Face 模型；权重许可为 CC BY-SA 4.0。 */
const BASE_URL = 'https://huggingface.co/oruk/orukeet/resolve/55a984d46f68323301837194ce647c702f55facc/onnx';

/** 独立安装目录，避免覆盖已安装的 Parakeet。 */
export const ORUKEET_MODEL_DIRECTORY = 'orukeet-v0.1.0-int8';

/** 下载清单用于核对归档身份；下载由 Hugging Face 的常规统计记录。 */
export const ORUKEET_MANIFEST = {
    url: `${BASE_URL}/manifest.json`,
    sha256: '7e80f93f0e9b923c392424b0f85d28a717feee0a4d2a6aa9bfa723693868e727',
};

/** 官方归档的固定名称、地址和内容摘要。 */
export const ORUKEET_ARCHIVE = {
    name: 'sherpa-onnx-orukeet-v0.1.0-int8.tar.bz2',
    url: `${BASE_URL}/sherpa-onnx-orukeet-v0.1.0-int8.tar.bz2`,
    sha256: 'f9191f30178cc9122ce2f023bf9fefafc822028307b0efa4caff645ba3fe8d0a',
};
