import { inject, injectable } from 'inversify';

import type Controller from '@/backend/controllers/Controller';
import registerRoute from '@/backend/controllers/ipc/registerRoute';
import type OnboardingService from '@/backend/services/OnboardingService';
import TYPES from '@/backend/ioc/types';

/** 提供首次使用引导的状态查询与完成标记路由。 */
@injectable()
export class OnboardingController implements Controller {
    /** 注入引导状态服务。 */
    public constructor(@inject(TYPES.OnboardingService) private readonly onboardingService: OnboardingService) {}

    /** 注册引导状态与完成标记路由。 */
    public registerRoutes(): void {
        registerRoute('onboarding/status', () => this.onboardingService.getStatus());
        registerRoute('onboarding/complete', () => this.onboardingService.complete());
    }
}
