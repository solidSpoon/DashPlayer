/**
 * 语音识别产生的带时间戳子词。
 */
export interface SpeechRecognitionToken {
    /** 子词文本，可能以空格开头表示新单词。 */
    text: string;
    /** 子词开始时间，单位为秒。 */
    start: number;
}

/**
 * 本地语音识别请求。
 */
export interface SpeechRecognitionRequest {
    /** 单声道 PCM WAV 文件路径。 */
    audioPath: string;
    /** 模型根目录。 */
    modelsRoot: string;
    /** 任务是否已取消。 */
    isCancelled?: () => boolean;
    /** 无原生百分比时用于刷新界面的心跳回调。 */
    onHeartbeat?: () => void;
}

/**
 * 本地语音识别结果。
 */
export interface SpeechRecognitionResult {
    /** 完整识别文本。 */
    text: string;
    /** 按模型输出顺序排列的子词时间轴。 */
    tokens: SpeechRecognitionToken[];
}

/**
 * 本地语音识别基础设施端口。
 */
export default interface SpeechRecognitionGateway {
    /**
     * 识别一个音频文件并返回结构化时间轴。
     * @param request 音频、模型与取消参数。
     */
    transcribe(request: SpeechRecognitionRequest): Promise<SpeechRecognitionResult>;

    /** 终止当前活跃的底层识别进程。 */
    cancelActive(): void;
}
