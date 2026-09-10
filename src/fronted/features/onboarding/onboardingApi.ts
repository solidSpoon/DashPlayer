import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { ONBOARDING_COMPLETED_VERSION_KEY } from '@/common/constants/systemConfigKeys';

/** 引导页需要的最小硬件信息：平台、内存总量与 CPU 核数。 */
export interface SystemInfo {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    pathSeparator: string;
    /** 物理内存总量（GB，保留一位小数）。 */
    totalMemoryGb: number;
    /** 逻辑 CPU 核数。 */
    cpuCount: number;
    /** 可用的 GPU 推理后端；none 表示会走 CPU 推理。 */
    gpuAcceleration: 'metal' | 'vulkan' | 'none';
}

/** 读取本机平台与硬件信息，用于按电脑配置推荐本地模型档位。 */
export const getSystemInfo = (): Promise<SystemInfo> => backendClient.call('system/info');

/**
 * 读取用户已完成的引导版本。
 *
 * @returns 已完成的版本号；从未完成过时返回 null。
 */
export const getOnboardingCompletedVersion = (): Promise<string | null> =>
    backendClient.call('system/config/get', ONBOARDING_COMPLETED_VERSION_KEY);

/**
 * 记录引导已完成到指定版本，后续启动不再展示引导。
 *
 * @param version 当前引导版本号。
 */
export const markOnboardingCompleted = (version: string): Promise<void> =>
    backendClient.call('system/config/set', {
        key: ONBOARDING_COMPLETED_VERSION_KEY,
        value: version,
    });
