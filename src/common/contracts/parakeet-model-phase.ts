/**
 * Parakeet v3 模型下载流程阶段。
 * `idle` 表示下载任务已结束（成功/失败/取消），用于向前端广播终态。
 */
export type ParakeetModelPhase = 'downloading' | 'extracting' | 'installing' | 'idle';
