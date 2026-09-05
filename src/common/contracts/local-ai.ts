/** 固定的本地模型标识，同时用于缓存隔离。 */
export const LOCAL_AI_MODEL_ID = 'qwen3-1.7b-q4_k_m-v1';

/** 本地模型管理页的状态；大小单位为字节。 */
export interface LocalAiStatus {
    ready: boolean;
    runtimeReady: boolean;
    running: boolean;
    phase: 'idle' | 'downloading' | 'verifying';
    downloaded: number;
    total: number;
    modelPath: string;
    downloadUrl: string;
    error: string | null;
}
