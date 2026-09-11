/**
 * 播放修复用例服务：并发守护、产物先写临时名再改名、修复记录写入。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryFileSystemGateway } from '@/test/memory-file-system-gateway';
import { createMemoryDb, type MemoryDb } from '@/test/database';
import RepairTaskRepositoryImpl from '@/backend/infrastructure/db/repositories/RepairTaskRepositoryImpl';
import { PlaybackRepairServiceImpl } from '@/backend/services/PlaybackRepairService';
import type DpTaskService from '@/backend/services/DpTaskService';
import type FfmpegService from '@/backend/services/FfmpegService';
import type StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import type PlaybackCapabilityService from '@/backend/services/PlaybackCapabilityService';
import { RepairTaskState } from '@/common/contracts/playback-repair';

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const SOURCE = '/media/a.mkv';
const OUTPUT = '/media/a.html5.mp4';
const TEMP = '/media/a.html5.mp4.part';

describe('播放修复用例服务', () => {
    let memoryDb: MemoryDb;
    let fsGateway: MemoryFileSystemGateway;
    let repairTaskRepository: RepairTaskRepositoryImpl;
    let dpTask: { create: ReturnType<typeof vi.fn>; process: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn>; checkCancel: ReturnType<typeof vi.fn> };
    let ffmpeg: { getVideoInfo: ReturnType<typeof vi.fn>; repair: ReturnType<typeof vi.fn>; extractSubtitles: ReturnType<typeof vi.fn> };
    let service: PlaybackRepairServiceImpl;
    let nextTaskId: number;
    let writtenWhileRepairing: string[];

    beforeEach(() => {
        nextTaskId = 1;
        memoryDb = createMemoryDb();
        repairTaskRepository = new RepairTaskRepositoryImpl(memoryDb.db);
        fsGateway = new MemoryFileSystemGateway();
        fsGateway.files.set(SOURCE, 'x'.repeat(1024));
        writtenWhileRepairing = [];
        dpTask = {
            create: vi.fn(async () => nextTaskId++),
            process: vi.fn(),
            finish: vi.fn(),
            fail: vi.fn(),
            checkCancel: vi.fn(),
        };
        ffmpeg = {
            getVideoInfo: vi.fn(async () => ({ duration: 100, videoCodec: 'h264', audioCodec: 'aac' })),
            repair: vi.fn(async (args: { outputFile: string }) => {
                // 记录 ffmpeg 实际写入的路径，并模拟写入产物内容。
                writtenWhileRepairing.push(args.outputFile);
                fsGateway.files.set(args.outputFile, 'y'.repeat(2048));
            }),
            extractSubtitles: vi.fn(async () => false),
        };
        const storage = {
            ensurePathAccessPermissionIfExists: vi.fn(async () => undefined),
            provideDirectory: vi.fn(),
            getRootStatus: vi.fn(),
        } as unknown as StorageDirectoryProvider;
        const capability = {
            getOverlay: vi.fn(async () => ({})),
        } as unknown as PlaybackCapabilityService;
        service = new PlaybackRepairServiceImpl(
            dpTask as unknown as DpTaskService,
            ffmpeg as unknown as FfmpegService,
            storage,
            fsGateway,
            capability,
            repairTaskRepository,
        );
    });

    afterEach(() => {
        memoryDb.close();
    });

    it('同一文件并发发起时只启动一次修复，两个调用方拿到同一条任务', async () => {
        // 让诊断停在半途，模拟两个入口几乎同时发起。
        let releaseDiagnose: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            releaseDiagnose = resolve;
        });
        ffmpeg.getVideoInfo.mockImplementation(async () => {
            await gate;
            return { duration: 100, videoCodec: 'h264', audioCodec: 'aac' };
        });

        const first = service.startRepair(SOURCE);
        const second = service.startRepair(SOURCE);
        releaseDiagnose();

        const [firstResult, secondResult] = await Promise.all([first, second]);
        expect(firstResult.taskId).toBe(1);
        expect(secondResult.taskId).toBe(1);
        expect(dpTask.create).toHaveBeenCalledTimes(1);
        expect(firstResult.diagnosis.needsRepair).toBe(true);
        // 只留一行记录，不会因为两边同时发起产生两行。
        expect(await repairTaskRepository.list()).toHaveLength(1);
    });

    it('产物先写临时名，验收通过后才改名为正式产物，记录落到完成状态', async () => {
        const started = await service.startRepair(SOURCE);
        expect(started.taskId).toBe(1);
        expect(started.diagnosis.outputPath).toBe(OUTPUT);
        // 修复开始后表里立刻是「进行中」，页面据此显示进度。
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.IN_PROGRESS,
            outputPath: OUTPUT,
            taskId: 1,
        });

        await vi.waitFor(() => expect(dpTask.finish).toHaveBeenCalledTimes(1));
        await vi.waitFor(async () => {
            expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
                status: RepairTaskState.DONE,
            });
        });

        expect(writtenWhileRepairing).toEqual([TEMP]);
        expect(fsGateway.files.has(TEMP)).toBe(false);
        expect(fsGateway.files.has(OUTPUT)).toBe(true);
        expect(ffmpeg.repair).toHaveBeenCalledTimes(1);
    });

    it('本来无需修复的媒体也会留下一条完成记录', async () => {
        fsGateway.files.set(OUTPUT, 'y'.repeat(2048));

        const result = await service.startRepair(SOURCE);

        expect(result.taskId).toBeNull();
        expect(ffmpeg.repair).not.toHaveBeenCalled();
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.DONE,
            reason: 'already-repaired',
        });
    });

    it('丢弃产物后记录变成已丢弃，产物与临时文件都被删掉', async () => {
        fsGateway.files.set(OUTPUT, 'y'.repeat(2048));
        await service.enqueueRepairTasks([SOURCE]);

        const discarded = await service.discardRepairOutput({ filePath: SOURCE, outputPath: OUTPUT });

        expect(discarded).toBe(true);
        expect(fsGateway.files.has(OUTPUT)).toBe(false);
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.DISCARDED,
        });
    });

    it('不同文件可以并行修复，记录各写一行', async () => {
        const otherSource = '/media/b.mkv';
        fsGateway.files.set(otherSource, 'x'.repeat(1024));

        const [first, second] = await Promise.all([
            service.startRepair(SOURCE),
            service.startRepair(otherSource),
        ]);

        expect(first.taskId).toBe(1);
        expect(second.taskId).toBe(2);
        expect(dpTask.create).toHaveBeenCalledTimes(2);
        expect(await repairTaskRepository.list()).toHaveLength(2);
    });

    it('重启后把遗留的进行中记录标记为已中断', async () => {
        fsGateway.files.set(OUTPUT, 'y'.repeat(2048));
        await service.enqueueRepairTasks([SOURCE]);
        await repairTaskRepository.updateByFilePath(SOURCE, {
            status: RepairTaskState.IN_PROGRESS,
            taskId: 7,
        });

        await service.recoverInterruptedTasks();

        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.CANCELLED,
            taskId: null,
        });
    });
});
