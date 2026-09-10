import { app } from 'electron';
import { getMainLogger } from '@/backend/infrastructure/logger';

/**
 * 本机可用的 GPU 推理后端。
 * - `metal`：macOS Apple Silicon（Metal）；
 * - `vulkan`：Linux 与 Windows x64（随包提供 Vulkan 运行包）；
 * - `none`：会走 CPU 推理（Windows arm64 官方没有 Vulkan 包，或未检测到真实显卡）。
 */
export type GpuAcceleration = 'metal' | 'vulkan' | 'none';

/**
 * 真实显卡的 PCI 厂商 ID（Chromium `gpuDevice[].vendorId`）。
 *
 * 只认会提供硬件加速的厂商；Microsoft 基础显示适配器、SwiftShader 等
 * 软件渲染器不在名单里，会被判为没有显卡。
 */
const REAL_GPU_VENDOR_IDS = new Set([
    0x106b, // Apple
    0x10de, // NVIDIA
    0x1002, // AMD
    0x8086, // Intel
    0x5143, // Qualcomm
]);

/**
 * 检测本机可用的 GPU 推理后端。
 *
 * 判定的是「应用实际会不会用上 GPU」：先按平台排除随包没有 GPU 后端的组合
 * （Windows arm64 只有 CPU 包；Intel Mac 的 macOS x64 运行包不启用 GPU），
 * 再向 Chromium 询问真实显卡是否存在；查不到显卡或探测失败时按 CPU 处理。
 *
 * 注意：这只是给引导页做档位建议用的**预判**。真正是否跑在 GPU 上由推理引擎
 * 启动时决定——llama.cpp 只要运行包带 GPU 后端就传 `--n-gpu-layers 99`，
 * 没有可用显卡时由它内部回退到 CPU。
 */
export async function detectGpuAcceleration(): Promise<GpuAcceleration> {
    if (process.platform === 'darwin') {
        return process.arch === 'arm64' ? 'metal' : 'none';
    }
    if (process.platform === 'win32' && process.arch !== 'x64') {
        return 'none';
    }
    return (await hasRealGpuDevice()) ? 'vulkan' : 'none';
}

/**
 * 通过 Chromium 的 GPU 信息判断是否存在真实显卡。
 *
 * @returns 存在受支持的显卡时返回 `true`；探测失败按没有显卡处理。
 */
async function hasRealGpuDevice(): Promise<boolean> {
    try {
        const info = await app.getGPUInfo('basic') as { gpuDevice?: Array<{ vendorId?: number }> };
        return (info.gpuDevice ?? []).some((device) => REAL_GPU_VENDOR_IDS.has(device.vendorId ?? -1));
    } catch (error) {
        getMainLogger('GpuAcceleration').warn('gpu info probe failed, assume cpu', { error });
        return false;
    }
}
