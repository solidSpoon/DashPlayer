import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';

/**
 * 计算"识别引擎默认值"迁移决策。
 *
 * 背景：`transcription.engine` 是新增设置键，老版本配置文件中不存在该键，
 * 直接依赖 schema 默认值会把升级用户切到 whisper-cpp，而他们的 GGUF 模型
 * 尚未下载，识别会立即报错。为让老用户平滑升级，决策规则如下：
 * - 配置中已持久化过引擎键：一律不动，尊重用户显式选择；
 * - 未持久化且 sherpa CPU 模型完整安装（说明用户在用本地识别）：沿用 `sherpa-onnx`；
 * - 未持久化且 sherpa 模型不完整（新用户或从未用本地识别）：返回 null，
 *   不写入配置，走 schema 新默认值 `whisper-cpp`。
 *
 * @param engineKeyPersisted 配置文件中是否真实存在 `transcription.engine` 键（非默认值兜底）。
 * @param sherpaModelInstalled sherpa Parakeet 模型必需文件是否齐全。
 * @returns 应写入的引擎值；null 表示不做迁移写入。
 */
export const resolveMigratedTranscriptionEngine = (
    engineKeyPersisted: boolean,
    sherpaModelInstalled: boolean,
): TranscriptionEngine | null => {
    if (engineKeyPersisted) {
        return null;
    }
    return sherpaModelInstalled ? 'sherpa-onnx' : null;
};
