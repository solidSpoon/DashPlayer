/**
 * 本地语音识别引擎。
 * - `whisper.cpp`：whisper.cpp parakeet-cli + GGUF 模型，支持核显加速（默认）；
 * - `sherpa-onnx`：sherpa-onnx-offline + INT8 ONNX 模型，纯 CPU（回退选项）。
 */
export type TranscriptionEngine = 'whisper-cpp' | 'sherpa-onnx';

/** 设置项 `transcription.engine` 的全部合法取值。 */
export const TRANSCRIPTION_ENGINES = ['whisper-cpp', 'sherpa-onnx'] as const satisfies readonly TranscriptionEngine[];
