/**
 * Whisper 可选的 VAD 模型版本。
 */
export type WhisperVadModel = 'silero-v5.1.2' | 'silero-v6.2.0';

/**
 * Whisper 识别模型规格。
 */
export type WhisperModelSize = 'base' | 'large';

/**
 * Whisper 进度事件。
 */
export interface WhisperProgressEvent {
    /**
     * 原始进度百分比，取值范围 0~100。
     */
    percent: number;
    /**
     * 是否心跳进度（非真实进度推进）。
     */
    heartbeat: boolean;
}

/**
 * Whisper 转录输入参数。
 */
export interface WhisperTranscribeRequest {
    /**
     * 待识别的预处理音频路径。
     */
    processedAudioPath: string;
    /**
     * 本次任务临时目录。
     */
    tempFolder: string;
    /**
     * 模型根目录（包含 whisper 与 whisper-vad 子目录）。
     */
    modelsRoot: string;
    /**
     * Whisper 主模型规格。
     */
    modelSize: WhisperModelSize;
    /**
     * 是否启用静音检测。
     */
    enableVad: boolean;
    /**
     * VAD 模型版本。
     */
    vadModel: WhisperVadModel;
    /**
     * 任务取消检查函数。
     */
    isCancelled?: () => boolean;
    /**
     * 进度事件回调。
     */
    onProgressEvent?: (event: WhisperProgressEvent) => void;
}

/**
 * Whisper 运行告警码。
 */
export type WhisperWarningCode = 'VAD_UNSUPPORTED';

/**
 * Whisper 转录输出结果。
 */
export interface WhisperTranscribeResult {
    /**
     * 生成的 SRT 文件绝对路径。
     */
    outSrt: string;
    /**
     * 运行期间产生的告警信息。
     */
    warnings: WhisperWarningCode[];
}

/**
 * 本地 Whisper 基础设施能力端口。
 */
export default interface WhisperGateway {
    /**
     * 执行一次本地 whisper.cpp 转录。
     */
    transcribe(request: WhisperTranscribeRequest): Promise<WhisperTranscribeResult>;

    /**
     * 取消当前活跃的底层识别进程。
     */
    cancelActive(): void;
}
