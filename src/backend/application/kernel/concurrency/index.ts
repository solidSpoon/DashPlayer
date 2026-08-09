import { createConcurrencyKernel } from '@/backend/application/kernel/concurrency/ConcurrencyKernel';
import { ConcurrencyLogger } from '@/backend/application/kernel/concurrency/types';

/**
 * 全局并发内核单例；内核本身不依赖基础设施，日志由组合根（main.ts）运行期注入。
 */
export const concurrency = createConcurrencyKernel();

/**
 * 向全局并发内核注入/更新日志端口；由应用组合根在启动时调用。
 * @param logger 日志端口；传 undefined 关闭并发内核日志。
 */
export const setConcurrencyLogger = (logger: ConcurrencyLogger | undefined): void => {
    concurrency.setLogger(logger);
};

export { createConcurrencyKernel } from '@/backend/application/kernel/concurrency/ConcurrencyKernel';
export type { ConcurrencyKernel } from '@/backend/application/kernel/concurrency/ConcurrencyKernel';

export { createSemaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';
export type { Semaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';

export { createMutex } from '@/backend/application/kernel/concurrency/primitives/Mutex';
export type { Mutex } from '@/backend/application/kernel/concurrency/primitives/Mutex';

export { createRateLimiter } from '@/backend/application/kernel/concurrency/primitives/RateLimiter';
export type { RateLimiter } from '@/backend/application/kernel/concurrency/primitives/RateLimiter';

export {
    createCooperativeScheduler,
} from '@/backend/application/kernel/concurrency/primitives/CooperativeScheduler';
export type {
    CooperativeScheduler,
} from '@/backend/application/kernel/concurrency/primitives/CooperativeScheduler';

export {
    ConcurrencyCancelledError,
    LockOrderViolationError,
    ConcurrencyTimeoutError,
} from '@/backend/application/kernel/concurrency/types';

export type {
    AcquireOptions,
    ConcurrencyLogger,
    ConcurrencyLoggerRef,
    KernelAcquireOptions,
    Permit,
    RateLimiterOptions,
    RateLimiterSnapshot,
    SchedulerOptions,
    SchedulerSnapshot,
    SemaphoreOptions,
    SemaphoreSnapshot,
    WaitTurnOptions,
    YieldOptions,
} from '@/backend/application/kernel/concurrency/types';

export type {
    ConcurrencyProfiles,
    RateLimiterProfile,
    SchedulerProfile,
    SemaphoreProfile,
} from '@/backend/application/kernel/concurrency/config/ConcurrencyProfiles';

export { defaultConcurrencyProfiles } from '@/backend/application/kernel/concurrency/config/ConcurrencyProfiles';
