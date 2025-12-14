import { describe, it, expect } from 'vitest';
import { computeResumeTime } from '@/fronted/lib/playerResume';

describe('computeResumeTime', () => {
    it('returns 0 for no progress', () => {
        expect(computeResumeTime({ progress: 0, duration: 100 })).toBe(0);
    });

    it('keeps progress when not near end', () => {
        expect(computeResumeTime({ progress: 50, duration: 100 })).toBe(50);
    });

    it('resets to 0 when progress is near end', () => {
        expect(computeResumeTime({ progress: 98, duration: 100 })).toBe(0);
        expect(computeResumeTime({ progress: 100, duration: 100 })).toBe(0);
    });

    it('resets to 0 for short media near end', () => {
        expect(computeResumeTime({ progress: 19, duration: 20 })).toBe(0);
    });

    it('handles invalid numbers safely', () => {
        // @ts-expect-error test invalid values
        expect(computeResumeTime({ progress: NaN, duration: 100 })).toBe(0);
        // @ts-expect-error test invalid values
        expect(computeResumeTime({ progress: 20, duration: NaN })).toBe(20);
    });
});
