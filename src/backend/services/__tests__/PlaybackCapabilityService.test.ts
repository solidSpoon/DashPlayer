import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SysConfRepositoryImpl from '@/backend/infrastructure/db/repositories/SysConfRepositoryImpl';
import { createMemoryDb, type MemoryDb } from '@/test/database';
import { PlaybackCapabilityServiceImpl, PLAYBACK_CAPABILITY_CACHE_KEY } from '@/backend/services/PlaybackCapabilityService';
import SysConfRepository from '@/backend/services/repositories/SysConfRepository';
import type { PlaybackEvidenceInput } from '@/common/contracts/playback-repair';

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

/**
 * 可固定 Electron 版本的测试替身：版本不一致会让缓存整体作废，用例借此模拟升级。
 */
class FixedVersionCapabilityService extends PlaybackCapabilityServiceImpl {
    /** 用例固定的版本号。 */
    constructor(
        sysConfRepository: SysConfRepository,
        private readonly fixedVersion: string,
    ) {
        super(sysConfRepository);
    }

    protected override getCurrentElectronVersion(): string {
        return this.fixedVersion;
    }
}

describe('播放能力学习缓存', () => {
    let memoryDb: MemoryDb;
    let sysConfRepository: SysConfRepositoryImpl;
    let service: FixedVersionCapabilityService;

    beforeEach(() => {
        memoryDb = createMemoryDb();
        sysConfRepository = new SysConfRepositoryImpl(memoryDb.db);
        service = new FixedVersionCapabilityService(sysConfRepository, '44.0.0');
    });

    afterEach(() => {
        memoryDb.close();
    });

    const videoEvidence = (overrides: Partial<PlaybackEvidenceInput> = {}) => ({
        codec: 'hevc',
        kind: 'video' as const,
        playable: false,
        conclusive: true,
        sourceFile: '/media/a.mp4',
        ...overrides,
    });

    it('初始没有任何学习结论，需要探测且覆盖层为空', async () => {
        expect(await service.shouldProbeCapability('h264', 'aac')).toBe(true);
        expect(await service.getOverlay('h264', 'aac')).toEqual({});
    });

    it('记录结论性负面证据后，诊断覆盖层返回不可解，且不再重复探测', async () => {
        await service.recordEvidence(videoEvidence());

        expect(await service.getOverlay('hevc')).toEqual({ video: 'unplayable' });
        expect(await service.shouldProbeCapability('hevc', null)).toBe(false);
    });

    it('非结论性证据被忽略，不下任何结论', async () => {
        await service.recordEvidence(videoEvidence({ conclusive: false }));

        expect(await service.getOverlay('hevc')).toEqual({});
        expect(await service.shouldProbeCapability('hevc', null)).toBe(true);
    });

    it('正面证据只用于避免重复探测，不影响诊断结论', async () => {
        await service.recordEvidence(videoEvidence({ codec: 'h264', playable: true }));

        expect(await service.getOverlay('h264')).toEqual({});
        expect(await service.shouldProbeCapability('h264', null)).toBe(false);
    });

    it('已定谳不可解的编码不被后续正面证据翻案', async () => {
        await service.recordEvidence(videoEvidence());
        await service.recordEvidence(videoEvidence({ playable: true, sourceFile: '/media/b.mp4' }));

        expect(await service.getOverlay('hevc')).toEqual({ video: 'unplayable' });
    });

    it('负面证据覆盖早前的正面结论：宁可保守转码也不放行黑屏', async () => {
        await service.recordEvidence(videoEvidence({ codec: 'h264', playable: true, sourceFile: '/media/a.mp4' }));
        await service.recordEvidence(videoEvidence({ codec: 'h264', sourceFile: '/media/b.mp4' }));

        expect(await service.getOverlay('h264')).toEqual({ video: 'unplayable' });
    });

    it('视频与音频结论互不干扰，覆盖层按维度返回', async () => {
        await service.recordEvidence(videoEvidence({ codec: 'hevc', kind: 'video' }));
        await service.recordEvidence(videoEvidence({ codec: 'aac', kind: 'audio', playable: true }));

        expect(await service.getOverlay('hevc', 'aac')).toEqual({ video: 'unplayable' });
        expect(await service.getOverlay(undefined, 'aac')).toEqual({});
    });

    it('Electron 版本变化后条目全部作废，重新学习', async () => {
        await service.recordEvidence(videoEvidence());
        expect(await service.getOverlay('hevc')).toEqual({ video: 'unplayable' });

        const upgraded = new FixedVersionCapabilityService(sysConfRepository, '45.0.0');
        expect(await upgraded.getOverlay('hevc')).toEqual({});
        expect(await upgraded.shouldProbeCapability('hevc', null)).toBe(true);
    });

    it('缓存内容损坏时重置为空缓存，不抛错也不影响后续写入', async () => {
        await sysConfRepository.setValue(PLAYBACK_CAPABILITY_CACHE_KEY, '{not-json');

        expect(await service.getOverlay('hevc')).toEqual({});

        await service.recordEvidence(videoEvidence());
        expect(await service.getOverlay('hevc')).toEqual({ video: 'unplayable' });
    });

    it('同一条证据重复上报不会叠加来源', async () => {
        await service.recordEvidence(videoEvidence());
        await service.recordEvidence(videoEvidence());

        const raw = JSON.parse(await sysConfRepository.getValue(PLAYBACK_CAPABILITY_CACHE_KEY) as string);
        expect(raw.entries.hevc.sources).toEqual(['/media/a.mp4']);
        expect(raw.entries.hevc.votes).toBe(1);
    });
});
