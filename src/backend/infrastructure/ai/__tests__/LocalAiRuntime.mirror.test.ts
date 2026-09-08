import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PassThrough } from 'stream';
import axios, { AxiosResponse } from 'axios';
import { LocalAiRuntime } from '@/backend/infrastructure/ai/LocalAiRuntime';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import type { SettingsStore } from '@/backend/services/gateways/SettingsStore';
import type { LocalAiModelDefinition } from '@/common/contracts/local-ai';

// LocalAiRuntime 的 import 链经 runtimeEnv 依赖 electron（读取 isPackaged），
// vitest 下必须 mock，与其他基础设施测试约定一致。
vi.mock('electron', () => ({
    app: { isPackaged: false, getVersion: () => 'test', getPath: () => '/tmp/dashplayer-local-ai-mirror-test-userdata' },
    shell: { openPath: vi.fn() },
}));

// 字符串常量供 mock 工厂与测试断言共用；vi.mock 工厂会被提升，无法引用普通顶层变量。
const { OFFICIAL_URL, MIRROR_URL, MODEL_BODY } = vi.hoisted(() => ({
    OFFICIAL_URL: 'https://official.example.com/test.gguf',
    MIRROR_URL: 'https://hf-mirror.example.com/test.gguf',
    MODEL_BODY: 'gguf-model-content',
}));

// emitProgress 等链路依赖真实模型目录查找；替换目录为单条测试模型，
// 字节数与 SHA256 与预置内容严格一致，模拟真实条目的完整性约束。
vi.mock('@/common/contracts/local-ai', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/common/contracts/local-ai')>();
    const { createHash } = await import('node:crypto');
    const testModel: LocalAiModelDefinition = {
        id: 'test-model',
        name: '测试模型',
        file: 'test.gguf',
        bytes: Buffer.byteLength(MODEL_BODY),
        sizeLabel: '~9 B',
        url: OFFICIAL_URL,
        mirrorUrl: MIRROR_URL,
        sha256: createHash('sha256').update(MODEL_BODY).digest('hex'),
        source: 'catalog',
    };
    return {
        ...actual,
        // 目录导出替换为测试条目，供 import 侧取用；
        // requireLocalAiModel 读取的是模块内部绑定，覆盖导出的 LOCAL_AI_MODELS 对它无效，
        // 必须直接替换查找函数，emitProgress 等链路才能解析测试模型。
        LOCAL_AI_MODELS: [testModel],
        requireLocalAiModel: (modelId: string) =>
            (modelId === testModel.id ? testModel : actual.requireLocalAiModel(modelId)),
    };
});

import { LOCAL_AI_MODELS } from '@/common/contracts/local-ai';

/** 与 mock 目录中一致的测试模型条目。 */
const TEST_MODEL: LocalAiModelDefinition = LOCAL_AI_MODELS[0];

/** 目录提供器测试替身：固定返回临时模型根目录。 */
class FixedStorageDirectoryProvider implements StorageDirectoryProvider {
    constructor(private readonly rootPath: string) {}

    public async provideDirectory(): Promise<string> {
        return this.rootPath;
    }

    public async ensurePathAccessPermissionIfExists(): Promise<void> {}

    public async getRootStatus(): Promise<never> {
        throw new Error('测试替身不提供目录状态');
    }
}

/** 渲染层网关测试替身：忽略进度广播。 */
class NoopRendererGateway implements RendererGateway {
    public async call(): Promise<void> {
        throw new Error('测试替身不处理后端调用前端');
    }

    public fireAndForget(): void {}
}

/** 暴露受保护 install 方法的运行时子类，便于直接测试下载选源与安装链路。 */
class ExposedLocalAiRuntime extends LocalAiRuntime {
    public installForTest(model: LocalAiModelDefinition, signal: AbortSignal): Promise<void> {
        return this.install(model, signal);
    }
}

/** 将 axios.head 打桩为按清单决定地址可达性。 */
function mockHead(reachableUrls: string[]): void {
    vi.spyOn(axios, 'head').mockImplementation(async (url: string) => {
        if (!reachableUrls.includes(url)) throw new Error('connection refused');
        return { status: 200, statusText: 'OK', headers: {}, data: undefined, config: {} } as unknown as AxiosResponse;
    });
}

/** 将 axios.get 打桩为返回一次性写完的流式响应。 */
function mockDownloadBody(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(axios, 'get').mockImplementation(async () => {
        const stream = new PassThrough();
        // 宏任务时序：install 在 await 后同步挂载 data 监听与 pipeline，数据必须在此之后写入
        // 宏任务时序：install 在 await 后同步挂载 data 监听与 pipeline，数据必须在此之后写入
        setTimeout(() => {
            stream.write(MODEL_BODY);
            stream.end();
        }, 0);
        return { status: 200, statusText: 'OK', headers: {}, data: stream, config: {} } as unknown as AxiosResponse;
    });
}

describe('本地模型下载的镜像回退', () => {
    let tmpRoot: string;
    let runtime: ExposedLocalAiRuntime;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashplayer-local-ai-'));
        runtime = new ExposedLocalAiRuntime(
            new FixedStorageDirectoryProvider(tmpRoot),
            new NoopRendererGateway(),
            {} as unknown as SettingsStore,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    /** 已安装模型文件的真实路径。 */
    function installedModelPath(): string {
        return path.join(tmpRoot, TEST_MODEL.id, TEST_MODEL.file);
    }

    it('官方与镜像都可达时优先从官方地址下载并安装', async () => {
        mockHead([OFFICIAL_URL, MIRROR_URL]);
        const getSpy = mockDownloadBody();

        await runtime.installForTest(TEST_MODEL, new AbortController().signal);

        expect(getSpy.mock.calls[0][0]).toBe(OFFICIAL_URL);
        expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(MODEL_BODY);
    });

    it('官方不可达时自动改用镜像地址下载且通过 SHA256 校验', async () => {
        mockHead([MIRROR_URL]);
        const getSpy = mockDownloadBody();

        await runtime.installForTest(TEST_MODEL, new AbortController().signal);

        expect(getSpy.mock.calls[0][0]).toBe(MIRROR_URL);
        expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(MODEL_BODY);
    });

    it('全部地址不可达时下载报错且不静默成功', async () => {
        mockHead([]);
        vi.spyOn(axios, 'get').mockRejectedValue(new Error('ECONNREFUSED: 网络不可达'));

        await expect(runtime.installForTest(TEST_MODEL, new AbortController().signal))
            .rejects.toThrow('ECONNREFUSED');
        expect(fs.existsSync(installedModelPath())).toBe(false);
    });

    it('未声明镜像的模型只使用官方地址且不发起探测', async () => {
        const headSpy = vi.spyOn(axios, 'head').mockRejectedValue(new Error('未声明镜像不应发起探测'));
        const getSpy = mockDownloadBody();
        const modelWithoutMirror: LocalAiModelDefinition = { ...TEST_MODEL, mirrorUrl: undefined };

        await runtime.installForTest(modelWithoutMirror, new AbortController().signal);

        expect(headSpy).not.toHaveBeenCalled();
        expect(getSpy.mock.calls[0][0]).toBe(OFFICIAL_URL);
        expect(fs.readFileSync(installedModelPath(), 'utf-8')).toBe(MODEL_BODY);
    });
});
