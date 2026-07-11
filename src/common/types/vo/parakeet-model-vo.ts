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
}
