import type { LocalAiStatus } from '@/common/contracts/local-ai';
import type { LocalMtStatus } from '@/common/contracts/local-mt';
import type { ResourceFallbackSnapshot } from '@/common/contracts/resource-fallback';
import type { SystemInfo } from '@/common/contracts/system-info';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';
import type { ModelInstallationStatusVO } from '@/common/types/vo/model-installation-vo';

/**
 * 资源状态聚合快照：设置页一次拿齐所有会变化的运行时状态。
 *
 * 拆成多个接口时，一次打开设置页要打六七个请求，且状态之间可能不同步；
 * 这里按"一页一次"聚合，识别方式与对应模型状态也保证同源。
 */
export interface ResourceStatusSnapshot {
    /** 当前字幕识别方式。 */
    transcriptionEngine: TranscriptionEngine;
    /** 发音模型状态。 */
    tts: ModelInstallationStatusVO;
    /** 字幕识别模型状态（随识别方式取 whisper.cpp 或 sherpa-onnx）。 */
    transcription: ModelInstallationStatusVO;
    /** 轻量翻译模型状态。 */
    localMt: LocalMtStatus;
    /** 本地增强资源包状态。 */
    localAi: LocalAiStatus;
    /** 本机硬件概要。 */
    hardware: SystemInfo;
    /** 各功能当前的回退状态。 */
    fallback: ResourceFallbackSnapshot;
}
