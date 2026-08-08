import { describe, it, expect } from 'vitest';
import MatchSrt from '@/backend/utils/MatchSrt';

describe('MatchSrt', () => {
    it('英语字幕优先于中文，即使中文是 srt 而英语是 vtt', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.zh.srt',
            '/tmp/movie.en.vtt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.en.vtt');
    });

    it('显式英语后缀优先于无后缀的纯同名字幕', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.srt',
            '/tmp/movie.en.srt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.en.srt');
    });

    it('无后缀纯同名字幕优先于中文后缀字幕', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.zh.srt',
            '/tmp/movie.srt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.srt');
    });

    it('语言相同时，srt 优先于 vtt', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.en.vtt',
            '/tmp/movie.en.srt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.en.srt');
    });

    it('语言档位相同（同为纯同名）时，srt 优先于 vtt', () => {
        const videoPath = '/tmp/movie.mp4';
        const subs = [
            '/tmp/movie.vtt',
            '/tmp/movie.srt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie.srt');
    });

    it('模糊匹配时名称相似度优先于格式', () => {
        const videoPath = '/tmp/movie_2026.mp4';
        const subs = [
            '/tmp/movie_2026.srt',
            '/tmp/movie_other.vtt',
        ];

        const matches = MatchSrt.matchAll(videoPath, subs);
        expect(matches[0]).toBe('/tmp/movie_2026.srt');
    });
});
