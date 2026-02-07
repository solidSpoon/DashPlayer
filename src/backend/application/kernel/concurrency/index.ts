import { createConcurrencyKernel } from '@/backend/application/kernel/concurrency/ConcurrencyKernel';

/**
 * 全局并发内核单例。
 */
export const concurrency = createConcurrencyKernel();

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
