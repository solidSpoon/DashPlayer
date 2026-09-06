import { inject, injectable } from 'inversify';

import type SystemConfigService from '@/backend/services/SystemConfigService';
import TYPES from '@/backend/ioc/types';
import { ONBOARDING_COMPLETED_VERSION_KEY, ONBOARDING_VERSION, type OnboardingStatusVO } from '@/common/contracts/onboarding';

/**
 * 首次使用引导的业务边界：维护“已完成引导版本”标记并判断是否需要弹引导。
 *
 * 标记持久化在系统配置表（dp_sys_conf），版本语义见 common/contracts/onboarding.ts。
 */
export default interface OnboardingService {
    /**
     * 查询引导状态。
     *
     * @returns 当前引导版本、已完成版本与是否需要展示。
     * @throws 已完成版本标记存在但不是合法非负整数时抛错，不做静默回退。
     */
    getStatus(): Promise<OnboardingStatusVO>;

    /**
     * 将引导标记为已完成，写入当前引导版本号。重复调用只更新时间戳，幂等。
     */
    complete(): Promise<void>;
}

/**
 * 基于系统配置表的引导状态实现。
 */
@injectable()
export class OnboardingServiceImpl implements OnboardingService {
    private readonly systemConfigService: SystemConfigService;

    public constructor(
        @inject(TYPES.SystemConfigService) systemConfigService: SystemConfigService,
    ) {
        this.systemConfigService = systemConfigService;
    }

    /**
     * 查询引导状态；无标记视为版本 0（从未完成）。
     *
     * @throws 标记值不是非负整数时抛错，暴露数据问题而非静默当作已完成。
     */
    public async getStatus(): Promise<OnboardingStatusVO> {
        const raw = await this.systemConfigService.getValue(ONBOARDING_COMPLETED_VERSION_KEY);
        let completedVersion = 0;
        if (raw !== null) {
            const parsed = Number(raw);
            if (!Number.isInteger(parsed) || parsed < 0) {
                throw new Error(`引导完成标记非法: ${raw}`);
            }
            completedVersion = parsed;
        }
        return {
            currentVersion: ONBOARDING_VERSION,
            completedVersion,
            shouldShow: completedVersion < ONBOARDING_VERSION,
        };
    }

    /**
     * 写入当前引导版本号；值来自后端常量，不信任前端传入。onConflictDoUpdate 保证幂等。
     */
    public async complete(): Promise<void> {
        await this.systemConfigService.setValue(ONBOARDING_COMPLETED_VERSION_KEY, String(ONBOARDING_VERSION));
    }
}
