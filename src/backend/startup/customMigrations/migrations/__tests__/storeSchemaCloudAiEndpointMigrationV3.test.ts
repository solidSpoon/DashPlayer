import { describe, it, expect, vi } from 'vitest';
import type { MainLogger } from '@/backend/infrastructure/logger';
import type { CustomMigrationContext } from '../../types';
import {
    resolveCloudAiEndpointMigrationOutputs,
    storeSchemaCloudAiEndpointMigrationV3,
} from '../storeSchemaCloudAiEndpointMigrationV3';

/** 取某个键的设置写入值；未写返回 undefined。 */
const setOf = (
    outputs: ReturnType<typeof resolveCloudAiEndpointMigrationOutputs>,
    key: string,
): string | undefined =>
    outputs.flatMap((output) => (output.kind === 'set' && output.key === key ? [output.value] : []))[0];

/** 是否包含某个键的删除操作。 */
const deletesKey = (
    outputs: ReturnType<typeof resolveCloudAiEndpointMigrationOutputs>,
    key: string,
): boolean => outputs.some((output) => output.kind === 'delete' && output.key === key);

describe('storeSchemaCloudAiEndpointMigrationV3 迁移决策', () => {
    it('开关开启时把历史接口地址展开成带 /v1 的完整地址，并删除旧开关键', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com',
            autoAppendV1: 'true',
        });

        expect(setOf(outputs, 'apiKeys.openAi.endpoint')).toBe('https://api.deepseek.com/v1');
        expect(deletesKey(outputs, 'apiKeys.openAi.autoAppendV1')).toBe(true);
    });

    it('开关关闭时地址保持原样（用户已自行包含版本路径），只删除旧开关键', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.moonshot.cn/v1',
            autoAppendV1: 'false',
        });

        expect(setOf(outputs, 'apiKeys.openAi.endpoint')).toBeUndefined();
        expect(deletesKey(outputs, 'apiKeys.openAi.autoAppendV1')).toBe(true);
    });

    it('未持久化过接口地址时不产生设置写入', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({ endpoint: null, autoAppendV1: null });

        expect(outputs.find((output) => output.kind === 'set')).toBeUndefined();
    });

    it('地址已以 /v1 结尾时不重复追加，重复执行迁移结果不变', () => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: 'https://api.deepseek.com/v1',
            autoAppendV1: 'true',
        });

        expect(setOf(outputs, 'apiKeys.openAi.endpoint')).toBeUndefined();
        expect(deletesKey(outputs, 'apiKeys.openAi.autoAppendV1')).toBe(true);
    });
});

describe('storeSchemaCloudAiEndpointMigrationV3 迁移执行', () => {
    it('run 经 ctx.settings 应用展开与删除', async () => {
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
        expect(deletes).toContain('apiKeys.openAi.autoAppendV1');
        expect(persisted['apiKeys.openAi.endpoint']).toBe('https://api.deepseek.com/v1');
        expect(persisted['apiKeys.openAi.autoAppendV1']).toBeUndefined();
    });
});
