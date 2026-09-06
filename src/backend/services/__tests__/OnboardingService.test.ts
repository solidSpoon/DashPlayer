import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import SysConfRepositoryImpl from '@/backend/infrastructure/db/repositories/SysConfRepositoryImpl';
import SystemConfigService, { SystemConfigServiceImpl } from '@/backend/services/SystemConfigService';
import OnboardingService, { OnboardingServiceImpl } from '@/backend/services/OnboardingService';
import { ONBOARDING_COMPLETED_VERSION_KEY, ONBOARDING_VERSION } from '@/common/contracts/onboarding';
import { createMemoryDb, type MemoryDb } from '@/test/database';

/**
 * 首次使用引导服务的内存数据库行为测试。
 *
 * 不 mock 仓储层，用真实 SQLite 内存库验证版本比较与完成标记的可观测行为。
 */
describe('首次使用引导服务', () => {
    let memoryDb: MemoryDb;
    let onboardingService: OnboardingService;
    let systemConfigService: SystemConfigService;

    beforeEach(() => {
        memoryDb = createMemoryDb();
        systemConfigService = new SystemConfigServiceImpl(new SysConfRepositoryImpl(memoryDb.db));
        onboardingService = new OnboardingServiceImpl(systemConfigService);
    });

    afterEach(() => {
        memoryDb.close();
    });

    it('从未完成过引导的新用户需要展示引导', async () => {
        const status = await onboardingService.getStatus();

        expect(status.currentVersion).toBe(ONBOARDING_VERSION);
        expect(status.completedVersion).toBe(0);
        expect(status.shouldShow).toBe(true);
    });

    it('完成后不再展示引导，并记录当前引导版本', async () => {
        await onboardingService.complete();

        const status = await onboardingService.getStatus();
        expect(status.completedVersion).toBe(ONBOARDING_VERSION);
        expect(status.shouldShow).toBe(false);
    });

    it('重复完成引导不报错，标记保持为当前版本', async () => {
        await onboardingService.complete();
        await onboardingService.complete();

        const status = await onboardingService.getStatus();
        expect(status.completedVersion).toBe(ONBOARDING_VERSION);
        expect(status.shouldShow).toBe(false);
    });

    it('引导内容升级后，完成过旧版本的用户需要再次展示引导', async () => {
        // 模拟用户在旧版本引导时写下的更低完成版本。
        await systemConfigService.setValue(ONBOARDING_COMPLETED_VERSION_KEY, String(ONBOARDING_VERSION - 1));

        const status = await onboardingService.getStatus();
        expect(status.completedVersion).toBe(ONBOARDING_VERSION - 1);
        expect(status.shouldShow).toBe(true);
    });

    it('完成标记损坏时抛错暴露数据问题，不静默当作已完成或未完成', async () => {
        await systemConfigService.setValue(ONBOARDING_COMPLETED_VERSION_KEY, 'not-a-number');

        await expect(onboardingService.getStatus()).rejects.toThrow('引导完成标记非法');
    });
});
