import { describe, it, expect } from 'vitest';
import SrtUtil from '@/common/utils/SrtUtil';

describe('SrtUtil.parseSrt (WebVTT)', () => {
    it('parses WEBVTT header, cue id, and timestamps', () => {
        const vtt = [
            'WEBVTT',
            '',
            'intro',
            '00:01.000 --> 00:02.500',
            'Hello',
            '',
            '00:03.000 --> 00:04.000 align:start position:0%',
            '<c.green>World</c>',
            '',
        ].join('\n');

        const lines = SrtUtil.parseSrt(vtt);
        expect(lines).toHaveLength(2);

        expect(lines[0]?.index).toBe(1);
        expect(lines[0]?.start).toBeCloseTo(1, 5);
        expect(lines[0]?.end).toBeCloseTo(2.5, 5);
        expect(lines[0]?.contentEn).toBe('Hello');

        expect(lines[1]?.index).toBe(2);
        expect(lines[1]?.start).toBeCloseTo(3, 5);
        expect(lines[1]?.end).toBeCloseTo(4, 5);
        expect(lines[1]?.contentEn).toBe('World');
    });
});

