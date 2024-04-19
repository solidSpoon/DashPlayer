export type RATE_LIMIT_KEY =
    | 'whisper'
    | 'gpt'
    | 'tencent'
    | 'tts';

const RateLimitConfig: Record<RATE_LIMIT_KEY, { maxRequests: number; timeWindow: number }> = {
    whisper: {maxRequests: 10, timeWindow: 1000},
    gpt: {maxRequests: 10, timeWindow: 1000},
    tencent: {maxRequests: 4, timeWindow: 1000},
    tts: {maxRequests: 10, timeWindow: 1000}
};


export default class RateLimiter {
    private static limits: Map<string, number[]> = new Map();

    public static async wait(key: RATE_LIMIT_KEY): Promise<void> {
        if (!this.limits.has(key)) {
            this.limits.set(key, []);
        }
        const timeWindow = RateLimitConfig[key].timeWindow;
        const maxRequests = RateLimitConfig[key].maxRequests;

        const now = Date.now();
        const timestamps = this.limits.get(key)!;

        // Remove timestamps outside the current time window
        while (timestamps.length && timestamps[0] <= now - timeWindow) {
            timestamps.shift();
        }

        if (timestamps.length >= maxRequests) {
            // Calculate the wait time
            const waitTime = (timestamps[0] + timeWindow) - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.wait(key); // Retry the request
        }

        // Log the request timestamp
        timestamps.push(now);
        this.limits.set(key, timestamps);
    }
}
