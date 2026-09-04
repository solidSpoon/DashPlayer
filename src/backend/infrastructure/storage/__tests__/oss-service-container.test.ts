import { describe, expect, it, vi } from 'vitest';
import { Container } from 'inversify';
import TYPES from '@/backend/ioc/types';
import ClipOssServiceImpl from '@/backend/infrastructure/storage/ClipOssServiceImpl';
import VideoLearningOssServiceImpl from '@/backend/infrastructure/storage/VideoLearningOssServiceImpl';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FfmpegService from '@/backend/services/FfmpegService';

// 日志模块是系统边界：测试里静音，避免真实落盘和对 Electron app 的依赖。
vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

/**
 * 验证片段存储实现能被 inversify 容器按生产装配方式解析。
 *
 * 这层测试防的是「直接 new 能跑、容器解析炸了」的装配问题：
 * inversify 解析子类时会沿原型链检查基类的 @injectable 元数据，
 * 基类装饰器缺失只有在容器解析路径上才会暴露。
 */
describe('片段存储实现的 IoC 装配', () => {
    /** 构造一个绑定了片段存储全部构造依赖的隔离容器。 */
    function buildContainer(): Container {
        const container = new Container();
        container.bind<FileSystemGateway>(TYPES.FileSystemGateway)
            .toConstantValue({} as FileSystemGateway);
        container.bind<StorageDirectoryProvider>(TYPES.StorageDirectoryProvider)
            .toConstantValue({} as StorageDirectoryProvider);
        container.bind<FfmpegService>(TYPES.FfmpegService)
            .toConstantValue({} as FfmpegService);
        return container;
    }

    it('收藏片段存储实现可以从容器解析并具备业务方法', () => {
        const container = buildContainer();
        container.bind(ClipOssServiceImpl).toSelf();

        const storage = container.get(ClipOssServiceImpl);

        expect(typeof storage.putClip).toBe('function');
        expect(typeof storage.get).toBe('function');
        expect(typeof storage.list).toBe('function');
    });

    it('单词视频存储实现可以从容器解析并具备业务方法', () => {
        const container = buildContainer();
        container.bind(VideoLearningOssServiceImpl).toSelf();

        const storage = container.get(VideoLearningOssServiceImpl);

        expect(typeof storage.putClip).toBe('function');
        expect(typeof storage.get).toBe('function');
        expect(typeof storage.list).toBe('function');
    });
});
