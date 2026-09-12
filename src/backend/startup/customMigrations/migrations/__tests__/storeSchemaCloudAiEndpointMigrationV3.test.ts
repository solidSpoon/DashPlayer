import { describe, it, expect, vi } from 'vitest';
import type { MainLogger } from '@/backend/infrastructure/logger';
import type { CustomMigrationContext } from '../../types';
import {
    resolveCloudAiEndpointMigrationOutputs,
    storeSchemaCloudAiEndpointMigrationV3,
} from '../storeSchemaCloudAiEndpointMigrationV3';

/** 取写入的目标地址；无写入返回 undefined。 */
const writtenEndpoint = (
    outputs: ReturnType<typeof resolveCloudAiEndpointMigrationOutputs>,
): string | undefined => outputs[0]?.value;

describe('storeSchemaCloudAiEndpointMigrationV3 迁移决策', () => {
    it('开关开启时把历史接口地址展开成带 /v1 的完整地址', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com',
            autoAppendV1: 'true',
        });

        expect(writtenEndpoint(outputs)).toBe('https://api.deepseek.com/v1');
    });

    it('开关从未持久化过（开关上线前的老用户）同样展开，否则升级后请求会缺 /v1', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com',
            autoAppendV1: null,
        });

        expect(writtenEndpoint(outputs)).toBe('https://api.deepseek.com/v1');
    });

    it('开关被显式关闭时地址保持原样（用户已自行包含版本路径）', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.moonshot.cn/v1beta',
            autoAppendV1: 'false',
        });

        expect(outputs).toEqual([]);
    });

    it('未持久化过接口地址时不写任何键', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({ endpoint: null, autoAppendV1: null });

        expect(outputs).toEqual([]);
    });

    it('地址已以 /v1 结尾时不重复追加，重跑结果不变', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com/v1',
            autoAppendV1: 'true',
        });

        expect(outputs).toEqual([]);
    });

    it('不产出旧开关键的任何写操作，交由重跑收敛', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com',
            autoAppendV1: 'true',
        });

        expect(outputs.map((output) => output.key)).toEqual(['apiKeys.openAi.endpoint']);
    });
});

describe('storeSchemaCloudAiEndpointMigrationV3 迁移执行', () => {
    it('run 经 ctx.settings 写入展开后的地址，且不动旧开关键', async () => {
        const persisted: Record<string, string> = {
            'apiKeys.openAi.endpoint': 'https://api.deepseek.com',
            'apiKeys.openAi.autoAppendV1': 'true',
        };
        const sets: Array<{ key: string, value: string }> = [];
        const deletes: string[] = [];
        const stubLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as unknown as MainLogger;

        await storeSchemaCloudAiEndpointMigrationV3.run({
            settings: {
                getPersisted: (key: string): string | null => persisted[key] ?? null,
                hasPersisted: (key: string): boolean => key in persisted,
                set: (key: string, value: string | null | undefined): boolean => {
                    persisted[key] = String(value);
                    sets.push({ key, value: String(value) });
                    return true;
                },
                delete: (key: string): void => {
                    delete persisted[key];
                    deletes.push(key);
                },
            },
            db: {} as unknown as CustomMigrationContext['db'],
            logger: stubLogger,
        });

        expect(sets).toContainEqual({ key: 'apiKeys.openAi.endpoint', value: 'https://api.deepseek.com/v1' });
        expect(deletes).toEqual([]);
        expect(persisted['apiKeys.openAi.endpoint']).toBe('https://api.deepseek.com/v1');
        expect(persisted['apiKeys.openAi.autoAppendV1']).toBe('true');
    });

    it('开关被显式关闭时 run 不写入任何键', async () => {
        const persisted: Record<string, string> = {
            'apiKeys.openAi.endpoint': 'https://api.moonshot.cn/v1',
            'apiKeys.openAi.autoAppendV1': 'false',
        };
        const sets: Array<{ key: string, value: string }> = [];
        const stubLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        } as unknown as MainLogger;

        await storeSchemaCloudAiEndpointMigrationV3.run({
            settings: {
                getPersisted: (key: string): string | null => persisted[key] ?? null,
                hasPersisted: (key: string): boolean => key in persisted,
                set: (key: string, value: string | null | undefined): boolean => {
                    persisted[key] = String(value);
                    sets.push({ key, value: String(value) });
                    return true;
                },
                delete: (key: string): void => {
                    delete persisted[key];
                },
            },
            db: {} as unknown as CustomMigrationContext['db'],
            logger: stubLogger,
        });

        expect(sets).toEqual([]);
        expect(persisted['apiKeys.openAi.endpoint']).toBe('https://api.moonshot.cn/v1');
    });
});
