/**
 * 本地语音识别引擎。
 * - `whisper.cpp`：whisper.cpp parakeet-cli + GGUF 模型，支持核显加速（默认）；
 * - `sherpa-onnx`：sherpa-onnx-offline + INT8 ONNX 模型，纯 CPU（回退选项）。
 */
export type TranscriptionEngine = 'whisper-cpp' | 'sherpa-onnx' | 'sherpa-onnx-orukeet';

/** 设置项 `transcription.engine` 的全部合法取值。 */
export const TRANSCRIPTION_ENGINES = ['whisper-cpp', 'sherpa-onnx', 'sherpa-onnx-orukeet'] as const satisfies readonly TranscriptionEngine[];

/** sherpa-onnx 可独立安装的模型；不改变现有引擎默认值。 */
export type ParakeetModelId = 'parakeet' | 'orukeet';
