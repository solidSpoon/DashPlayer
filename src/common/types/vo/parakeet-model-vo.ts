import type { ParakeetModelPhase } from '@/common/contracts/parakeet-model-phase';

/**
 * Parakeet v3 本地模型状态。
 */
export interface ParakeetModelStatusVO {
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
    /** 官方模型归档下载地址。 */
    downloadUrl: string;
    /** 手动下载时应保存的归档完整路径。 */
    archivePath: string;
}
