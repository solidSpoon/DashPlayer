/**
 * 本机硬件概要：设置页用它判断本地资源包是否跑得动。
 */

/** 可用的 GPU 加速后端。 */
export type GpuAcceleration = 'metal' | 'vulkan' | 'none';

export interface SystemInfo {
    /** 内存总量（GB，保留一位小数）。 */
    totalMemoryGb: number;
    /** 逻辑 CPU 核数。 */
    cpuCount: number;
    /** 可用的 GPU 加速后端；`none` 表示只能走 CPU。 */
    gpuAcceleration: GpuAcceleration;
}
