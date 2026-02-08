/**
 * 信号量配置。
 */
export interface SemaphoreProfile {
    /**
     * 并发容量。
     */
    capacity: number;
}

/**
 * 速率限制配置。
 */
export interface RateLimiterProfile {
    /**
     * 单窗口最大请求数。
     */
    maxRequests: number;
    /**
     * 窗口大小（毫秒）。
     */
    windowMs: number;
}

/**
 * 调度器配置。
 */
export interface SchedulerProfile {
    /**
     * 时间片预算（毫秒）。
     */
    timeSliceMs: number;
    /**
     * 每次让步时长（毫秒）。
     */
    yieldDelayMs: number;
}

/**
 * 并发内核配置集合。
 */
export interface ConcurrencyProfiles {
    /**
     * 所有信号量配置。
     */
    semaphore: Record<string, SemaphoreProfile>;
    /**
     * 所有速率限制器配置。
     */
    rateLimiter: Record<string, RateLimiterProfile>;
    /**
     * 所有调度器配置。
     */
    scheduler: Record<string, SchedulerProfile>;
}

/**
 * DashPlayer 默认并发配置。
 */
export const defaultConcurrencyProfiles: ConcurrencyProfiles = {
    semaphore: {
        ffmpeg: { capacity: 5 },
        ffprobe: { capacity: 5 },
        whisper: { capacity: 10 },
    },
    rateLimiter: {
        whisper: { maxRequests: 5, windowMs: 1000 },
        gpt: { maxRequests: 10, windowMs: 1000 },
        tencent: { maxRequests: 4, windowMs: 1000 },
        tts: { maxRequests: 10, windowMs: 1000 },
    },
    scheduler: {
        default: { timeSliceMs: 8, yieldDelayMs: 0 },
    },
};

