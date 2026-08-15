import type { ParakeetModelPhase } from '@/common/contracts/parakeet-model-phase';

/**
 * Sherpa-ONNX 本地 TTS 模型状态。
 */
export interface SherpaTtsModelStatusVO {
    /** 模型文件所在目录。 */
    modelPath: string;
    /** 所有必需模型文件是否均已存在。 */
    ready: boolean;
    /** 缺失的必需文件名。 */
    missingFiles: string[];
    /** 是否有下载任务正在进行。 */
    downloading: boolean;
    /** 当前下载阶段；未在下载时为 null。 */
    phase: ParakeetModelPhase | null;
    /** 当前下载进度百分比（0-100）；未在下载时为 0。 */
    percent: number;
}
