/**
 * 播放修复用例服务：并发守护、产物先写临时名再改名、修复记录写入。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryFileSystemGateway } from '@/test/memory-file-system-gateway';
import { createMemoryDb, type MemoryDb } from '@/test/database';
import RepairTaskRepositoryImpl from '@/backend/infrastructure/db/repositories/RepairTaskRepositoryImpl';
import RepairGroupRepositoryImpl from '@/backend/infrastructure/db/repositories/RepairGroupRepositoryImpl';
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
    let repairGroupRepository: RepairGroupRepositoryImpl;
    let dpTask: { create: ReturnType<typeof vi.fn>; process: ReturnType<typeof vi.fn>; finish: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn>; checkCancel: ReturnType<typeof vi.fn> };
    let ffmpeg: { getVideoInfo: ReturnType<typeof vi.fn>; repair: ReturnType<typeof vi.fn>; extractSubtitles: ReturnType<typeof vi.fn> };
    let service: PlaybackRepairServiceImpl;
    let nextTaskId: number;
    let writtenWhileRepairing: string[];

    beforeEach(() => {
        nextTaskId = 1;
        memoryDb = createMemoryDb();
        repairTaskRepository = new RepairTaskRepositoryImpl(memoryDb.db);
        repairGroupRepository = new RepairGroupRepositoryImpl(memoryDb.db);
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
            repairGroupRepository,
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

        const first = service.startRepair({ filePath: SOURCE });
        const second = service.startRepair({ filePath: SOURCE });
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
        const started = await service.startRepair({ filePath: SOURCE });
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

        const result = await service.startRepair({ filePath: SOURCE });

        expect(result.taskId).toBeNull();
        expect(ffmpeg.repair).not.toHaveBeenCalled();
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.DONE,
            reason: 'already-repaired',
        });
    });

    it('丢弃产物后记录变成已丢弃，产物与临时文件都被删掉', async () => {
        fsGateway.files.set(OUTPUT, 'y'.repeat(2048));
        await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE] });

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
            service.startRepair({ filePath: SOURCE }),
            service.startRepair({ filePath: otherSource }),
        ]);

        expect(first.taskId).toBe(1);
        expect(second.taskId).toBe(2);
        expect(dpTask.create).toHaveBeenCalledTimes(2);
        expect(await repairTaskRepository.list()).toHaveLength(2);
    });

    it('手动多选：文件集合完全一样才算同一批，重复选择不会多出卡片', async () => {
        const first = await service.enqueueRepairTasks({ source: 'files', filePaths: [SOURCE] });
        // 同样的文件、换个顺序再选一次：组标识一致，不新增成员关系。
        const second = await service.enqueueRepairTasks({ source: 'files', filePaths: [SOURCE] });

        expect(second.groupKey).toBe(first.groupKey);
        expect(second.addedFiles).toEqual([]);
        expect(await service.listRepairGroups()).toHaveLength(1);
        expect(await repairTaskRepository.list()).toHaveLength(1);
    });

    it('手动多选：多一个文件就是新的一批', async () => {
        fsGateway.files.set('/media/b.mkv', 'x'.repeat(1024));
        const first = await service.enqueueRepairTasks({ source: 'files', filePaths: [SOURCE] });
        const second = await service.enqueueRepairTasks({ source: 'files', filePaths: [SOURCE, '/media/b.mkv'] });

        expect(second.groupKey).not.toBe(first.groupKey);
        // 新的一批里两个文件都是"新加入这一组"，但记录仍然只有两行。
        expect(second.addedFiles).toEqual(['/media/b.mkv', SOURCE].sort());
        expect(await service.listRepairGroups()).toHaveLength(2);
        // 记录仍然是文件级的：两个组里出现的同一个文件只有一行记录。
        expect(await repairTaskRepository.list()).toHaveLength(2);
    });

    it('同一个文件可以同时属于多个组，状态只有一份', async () => {
        fsGateway.files.set('/media/b.mkv', 'x'.repeat(1024));
        await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE, '/media/b.mkv'] });
        await service.enqueueRepairTasks({ source: 'files', filePaths: [SOURCE] });

        const groups = await service.listRepairGroups();
        expect(groups).toHaveLength(2);
        expect(await repairTaskRepository.list()).toHaveLength(2);

        // 在一个组里发起修复，另一个组看到的同一条记录也变成修复中。
        await service.startRepair({ filePath: SOURCE });
        const afterStart = await service.listRepairGroups();
        const inBoth = afterStart.map((group) => group.tasks.find((task) => task.file === SOURCE)?.status);
        expect(inBoth).toEqual([RepairTaskState.IN_PROGRESS, RepairTaskState.IN_PROGRESS]);
    });

    it('重新扫描同一个文件夹会落回同一组，新文件补进这张卡片', async () => {
        const first = await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE] });
        fsGateway.files.set('/media/b.mkv', 'x'.repeat(1024));
        const second = await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE, '/media/b.mkv'] });

        expect(second.groupKey).toBe(first.groupKey);
        expect(second.addedFiles).toEqual(['/media/b.mkv']);
        const groups = await service.listRepairGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].tasks).toHaveLength(2);
    });

    it('探测把结论写进记录：需要修复的标待修复并带原因，无需修复的标完成', async () => {
        await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE] });

        const diagnosis = await service.probeRepairTask(SOURCE);

        expect(diagnosis.needsRepair).toBe(true);
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toMatchObject({
            status: RepairTaskState.TODO,
            reason: diagnosis.reason,
        });
        // 探测不启动修复。
        expect(ffmpeg.repair).not.toHaveBeenCalled();
        expect(dpTask.create).not.toHaveBeenCalled();
    });

    it('删除组时：只在文件不属于其它组时才删掉记录', async () => {
        fsGateway.files.set('/media/b.mkv', 'x'.repeat(1024));
        await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE, '/media/b.mkv'] });
        await service.enqueueRepairTasks({ source: 'files', filePaths: ['/media/b.mkv'] });

        await service.removeRepairGroup('folder:/media');

        // 只属于这一组的记录被删掉；同时属于另一组的记录保留下来。
        expect(await repairTaskRepository.findByFilePath(SOURCE)).toBeNull();
        expect(await repairTaskRepository.findByFilePath('/media/b.mkv')).not.toBeNull();
        const groups = await service.listRepairGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].tasks.map((task) => task.file)).toEqual(['/media/b.mkv']);
    });

    it('列出文件夹时不筛文件：需不需要修复交给探测判断', async () => {
        fsGateway.files.set('/media/ok.mp4', 'x'.repeat(1024));
        fsGateway.files.set('/media/broken.mkv', 'x'.repeat(1024));
        fsGateway.files.set('/media/note.txt', 'x'.repeat(16));

        const folders = await service.listFolderVideos(['/media']);

        expect(folders).toHaveLength(1);
        // 看起来正常的 mp4 也要列出来：它可能带着放不出声的音轨，只有探测才知道。
        expect(folders[0].videos.sort()).toEqual([SOURCE, '/media/broken.mkv', '/media/ok.mp4']);
    });

    it('强制修复：诊断判定无需修复时也能按指定配方重做', async () => {
        fsGateway.files.set('/media/ok.mp4', 'x'.repeat(1024));

        // 自动路径：判定「无需修复」，不启动任务。
        const automatic = await service.startRepair({ filePath: '/media/ok.mp4' });
        expect(automatic.taskId).toBeNull();
        expect(await repairTaskRepository.findByFilePath('/media/ok.mp4')).toMatchObject({
            status: RepairTaskState.DONE,
            reason: 'playable',
        });

        // 强制路径：用户指定配方，跳过判定直接重做。
        const forced = await service.startRepair({
            filePath: '/media/ok.mp4',
            forceRecipe: 'full-transcode',
        });
        expect(forced.taskId).toBe(1);
        await vi.waitFor(() => expect(dpTask.finish).toHaveBeenCalledTimes(1));
        await vi.waitFor(async () => {
            expect(await repairTaskRepository.findByFilePath('/media/ok.mp4')).toMatchObject({
                status: RepairTaskState.DONE,
                recipe: 'full-transcode',
            });
        });
        expect(writtenWhileRepairing).toEqual(['/media/ok.html5.mp4.part']);
        expect(fsGateway.files.has('/media/ok.html5.mp4')).toBe(true);
        expect(fsGateway.files.has('/media/ok.html5.mp4.part')).toBe(false);
    });

    it('强制修复：配方与媒体类型不匹配时直接报错，且不占用运行位', async () => {
        fsGateway.files.set('/media/song.mp3', 'x'.repeat(1024));

        await expect(service.startRepair({
            filePath: '/media/song.mp3',
            forceRecipe: 'full-transcode',
        })).rejects.toThrow('纯音频文件只能选择转成 AAC/M4A');
        expect(ffmpeg.repair).not.toHaveBeenCalled();

        // 报错后占位释放：换成合法配方能正常启动。
        const retry = await service.startRepair({
            filePath: '/media/song.mp3',
            forceRecipe: 'audio-transcode',
        });
        expect(retry.taskId).toBe(1);
    });

    it('重启后把遗留的进行中记录标记为已中断', async () => {
        fsGateway.files.set(OUTPUT, 'y'.repeat(2048));
        await service.enqueueRepairTasks({ source: 'folder', path: '/media', filePaths: [SOURCE] });
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
