import { describe, expect, it } from 'vitest';
import TimeUtil from '@/common/utils/TimeUtil';

describe('TimeUtil', () => {
    describe('secondToTimeStrCompact', () => {
        it('handles null and undefined', () => {
            expect(TimeUtil.secondToTimeStrCompact(null)).toBe('');
            expect(TimeUtil.secondToTimeStrCompact(undefined)).toBe('');
        });

        it('formats zero seconds with zero-padding', () => {
            expect(TimeUtil.secondToTimeStrCompact(0)).toBe('00:00');
        });

        it('formats minutes and seconds with padding', () => {
            expect(TimeUtil.secondToTimeStrCompact(5)).toBe('00:05');
            expect(TimeUtil.secondToTimeStrCompact(65)).toBe('01:05');
            expect(TimeUtil.secondToTimeStrCompact(125)).toBe('02:05');
        });

        it('formats hours, minutes, and seconds with padding', () => {
            expect(TimeUtil.secondToTimeStrCompact(3600)).toBe('1:00:00');
            expect(TimeUtil.secondToTimeStrCompact(4729)).toBe('1:18:49');
            expect(TimeUtil.secondToTimeStrCompact(3605)).toBe('1:00:05');
        });
    });
});
