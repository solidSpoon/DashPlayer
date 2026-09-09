import os from 'node:os';
import { detectGpuAcceleration } from '@/backend/utils/gpuAcceleration';
import type { SystemInfo } from '@/common/contracts/system-info';

/**
 * 读取本机硬件概要。
 *
 * 内存与核数直接来自 Node 的 os 模块；GPU 加速后端需要探测，
 * 探测失败时按"没有加速"处理并在日志里留痕。
 *
 * @returns 内存总量（GB）、逻辑核数与 GPU 加速后端。
 */
export const readSystemInfo = async (): Promise<SystemInfo> => ({
    totalMemoryGb: Math.round((os.totalmem() / 1024 / 1024 / 1024) * 10) / 10,
    cpuCount: os.cpus().length,
    gpuAcceleration: await detectGpuAcceleration(),
});
