import { backendClient } from '@/fronted/infrastructure/electron/backendClient';

/**
 * 首次使用引导功能调用的后端接口。
 */
export const onboardingApi = {
    /**
     * 查询引导状态。
     *
     * @returns 当前引导版本、已完成版本与是否需要展示。
     */
    getStatus: () => backendClient.call('onboarding/status'),

    /**
     * 将引导标记为已完成（写入当前引导版本号）。
     *
     * @returns 写入完成后结束。
     */
    complete: () => backendClient.call('onboarding/complete'),
};
