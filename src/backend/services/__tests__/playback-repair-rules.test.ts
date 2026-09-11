import { describe, expect, it } from 'vitest';

import {
    decideRepair,
    type PlaybackFacts,
} from '@/backend/services/playback-repair-rules';
import type { LearnedCapabilityOverlay } from '@/common/contracts/playback-repair';

/**
 * 构造一份视频文件的事实集合，按需覆盖字段。
 */
const videoFacts = (overrides: Partial<PlaybackFacts>): PlaybackFacts => ({
    fileName: 'sample.mp4',
    hasVideoStream: true,
    hasAudioStream: true,
    ...overrides,
});

/**
 * 构造一份纯音频文件的事实集合。
 */
const audioFacts = (overrides: Partial<PlaybackFacts>): PlaybackFacts => ({
    fileName: 'sample.mp3',
    hasVideoStream: false,
    hasAudioStream: true,
    ...overrides,
});

describe('播放修复判定规则', () => {
    describe('静态白名单的基础判定', () => {
        it('CBR MP3 可直接播放，VBR 和无法判定的 MP3 都要修复', () => {
            expect(decideRepair(audioFacts({ fileName: 'a.mp3', mp3BitrateMode: 'cbr' }))).toEqual({
                needsRepair: false,
                reason: 'playable',
            });
            expect(decideRepair(audioFacts({ fileName: 'a.mp3', mp3BitrateMode: 'vbr' })).recipe).toBe('audio-transcode');
            expect(decideRepair(audioFacts({ fileName: 'a.mp3', mp3BitrateMode: 'unknown' })).reason).toBe('mp3-seek-imprecise');
        });

        it('WMA 容器与 MKV 音频转 M4A，普通音频文件直接播放', () => {
            expect(decideRepair(audioFacts({ fileName: 'a.wma' })).recipe).toBe('audio-transcode');
            expect(decideRepair(audioFacts({ fileName: 'a.m4a' })).needsRepair).toBe(false);
        });

        it('MKV 里 H.264 + AAC 只换壳，DTS 音轨要转码', () => {
            expect(decideRepair(videoFacts({ fileName: 'a.mkv', videoCodec: 'h264', audioCodec: 'aac' }))).toEqual({
                needsRepair: true,
                reason: 'unsupported-container',
                recipe: 'remux-copy',
            });
            expect(decideRepair(videoFacts({ fileName: 'a.mkv', videoCodec: 'h264', audioCodec: 'dts' })).recipe).toBe('video-copy-audio-transcode');
        });

        it('AVI/WMV/FLV 一律整片重编码，mpeg4-in-MP4 属于视频不可解', () => {
            expect(decideRepair(videoFacts({ fileName: 'a.avi', videoCodec: 'h264', audioCodec: 'aac' })).recipe).toBe('full-transcode');
            expect(decideRepair(videoFacts({ fileName: 'a.wmv', videoCodec: 'wmv2', audioCodec: 'wmav2' })).recipe).toBe('full-transcode');
            expect(decideRepair(videoFacts({ fileName: 'a.mp4', videoCodec: 'mpeg4', audioCodec: 'aac' })).reason).toBe('undecodable-video');
        });

        it('只有音轨的 MKV：可搬编码只换容器，不可搬编码转音频', () => {
            expect(decideRepair(videoFacts({ fileName: 'a.mkv', hasVideoStream: false, audioCodec: 'aac' })).recipe).toBe('audio-transcode');
            expect(decideRepair(videoFacts({ fileName: 'a.mkv', hasVideoStream: false, audioCodec: 'dts' })).reason).toBe('unsupported-audio');
        });

        it('mp3-in-MP4（无视频流、无独立音轨容器问题）可直接播放', () => {
            expect(decideRepair(videoFacts({ fileName: 'a.mp4', hasVideoStream: false, audioCodec: 'mp3' })).needsRepair).toBe(false);
        });
    });

    describe('学习覆盖层叠加', () => {
        it('实测不可解的视频编码被收紧为整片重编码', () => {
            const learned: LearnedCapabilityOverlay = { video: 'unplayable' };
            const decision = decideRepair(videoFacts({ fileName: 'a.mkv', videoCodec: 'h264', audioCodec: 'aac' }), learned);
            expect(decision).toEqual({ needsRepair: true, reason: 'undecodable-video', recipe: 'full-transcode' });
        });

        it('实测不可解的音频编码让 MKV 从换壳升级为音频转码', () => {
            const learned: LearnedCapabilityOverlay = { audio: 'unplayable' };
            expect(decideRepair(videoFacts({ fileName: 'a.mkv', videoCodec: 'h264', audioCodec: 'aac' }), learned).recipe)
                .toBe('video-copy-audio-transcode');
        });

        it('实测不可解的音频编码让只有音轨的 MP4 转音频', () => {
            const learned: LearnedCapabilityOverlay = { audio: 'unplayable' };
            const decision = decideRepair(videoFacts({ fileName: 'a.mp4', hasVideoStream: false, audioCodec: 'mp3' }), learned);
            expect(decision).toEqual({ needsRepair: true, reason: 'unsupported-audio', recipe: 'audio-transcode' });
        });

        it('学习层只收紧不放松：白名单外的编码不因实测可解而免修', () => {
            const learned: LearnedCapabilityOverlay = { video: 'playable' };
            expect(decideRepair(videoFacts({ fileName: 'a.mp4', videoCodec: 'mpeg4', audioCodec: 'aac' }), learned).recipe)
                .toBe('full-transcode');
        });

        it('正面结论不影响任何判定，无覆盖层时行为不变', () => {
            const facts = videoFacts({ fileName: 'a.mkv', videoCodec: 'h264', audioCodec: 'aac' });
            expect(decideRepair(facts, { video: 'playable', audio: 'playable' }))
                .toEqual(decideRepair(facts));
        });
    });
});
