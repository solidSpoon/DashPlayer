export function computeResumeTime(opts: { progress: number; duration: number }): number {
    const progress = Number.isFinite(opts.progress) ? opts.progress : 0;
    const duration = Number.isFinite(opts.duration) ? opts.duration : 0;
    if (progress <= 0 || duration <= 0) return Math.max(0, progress);

    const remaining = duration - progress;
    const nearEndThresholdSeconds = Math.min(15, Math.max(3, duration * 0.05));
    if (remaining <= nearEndThresholdSeconds) {
        return 0;
    }
    return Math.max(0, Math.min(progress, duration));
}
