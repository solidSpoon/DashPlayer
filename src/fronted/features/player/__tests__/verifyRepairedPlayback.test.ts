import { describe, expect, it } from 'vitest';

import {
    assessPlaybackVerification,
    type PlaybackVerificationTarget,
} from '../verifyRepairedPlayback';

/** 构造验收目标。 */
const target = (expectVideo: boolean, expectAudio: boolean): PlaybackVerificationTarget => ({ expectVideo, expectAudio });

describe('真机验收信号判定', () => {
    it('有画面且有解码计数时通过', () => {
        const result = assessPlaybackVerification(target(true, true), {
            videoWidth: 1280,
            decoded: { video: 1024, audio: 4096 },
        });
        expect(result).toEqual({ ok: true, failedDimensions: [] });
    });

    it('视频黑屏（videoWidth 为 0）判视频维度失败', () => {
        const result = assessPlaybackVerification(target(true, true), {
            videoWidth: 0,
            decoded: { video: 0, audio: 4096 },
        });
        expect(result.ok).toBe(false);
        expect(result.failedDimensions).toEqual(['video']);
    });

    it('进度在走的「无声」文件（音频计数为 0）判音频维度失败', () => {
        const result = assessPlaybackVerification(target(true, true), {
            videoWidth: 1280,
            decoded: { video: 1024, audio: 0 },
        });
        expect(result.ok).toBe(false);
        expect(result.failedDimensions).toEqual(['audio']);
    });

    it('计数器缺失（null）不冒充零解码：有画面时不判失败', () => {
        const result = assessPlaybackVerification(target(true, true), {
            videoWidth: 1280,
            decoded: { video: null, audio: null },
        });
        expect(result).toEqual({ ok: true, failedDimensions: [] });
    });

    it('计数器缺失但确实没有画面时，仍凭 videoWidth 判视频失败', () => {
        const result = assessPlaybackVerification(target(true, false), {
            videoWidth: 0,
            decoded: { video: null, audio: null },
        });
        expect(result.failedDimensions).toEqual(['video']);
    });

    it('纯音频产物的视频维度不参与判定', () => {
        const result = assessPlaybackVerification(target(false, true), {
            videoWidth: 0,
            decoded: { video: null, audio: 4096 },
        });
        expect(result).toEqual({ ok: true, failedDimensions: [] });
    });

    it('两个维度都失败时全部上报，便于逐维度归因', () => {
        const result = assessPlaybackVerification(target(true, true), {
            videoWidth: 0,
            decoded: { video: 0, audio: 0 },
        });
        expect(result.failedDimensions).toEqual(['video', 'audio']);
    });
});
