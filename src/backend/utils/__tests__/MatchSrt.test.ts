import { describe, it, expect } from 'vitest';
import MatchSrt from '@/backend/utils/MatchSrt';

describe('MatchSrt', () => {
    it('prefers .srt over .vtt in strong matches', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.en.vtt',
            '/tmp/movie.srt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.srt');
    });
});

