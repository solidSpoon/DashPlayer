import { joinUrl } from '@/common/utils/Util';

import type { CustomMigration } from '../types';

const MIGRATION_ID = 'store-schema-cloud-ai-endpoint-v3';

/** 迁移需要读取的持久化键值。 */
export type CloudAiEndpointMigrationReads = {
    /** 持久化的云端接口地址；未持久化过为 null。 */
    endpoint: string | null;
    /** 旧版「自动追加 /v1」开关的持久化值；未持久化过为 null。 */
    autoAppendV1: string | null;
};

/** 迁移产生的单个写操作：设置键值或删除键。 */
export type CloudAiEndpointMigrationOutput =
    | { kind: 'set'; key: 'apiKeys.openAi.endpoint'; value: string }
    | { kind: 'delete'; key: 'apiKeys.openAi.autoAppendV1' };

/**
 * 计算云端接口地址迁移的写操作序列。
 *
 * 存储语义从「地址（不含 /v1）+ 是否自动追加 /v1 开关」改为「完整 base URL 直存」。
 * 仅展开用户显式持久化过的 endpoint；历史数据契约是「开关开启时地址不含 /v1」，
 * 据此拼接；已带 /v1 结尾的地址不重复追加，避免重跑或脏数据造成 /v1/v1。
 * autoAppendV1 键随之废弃，无论是否持久化过都产出删除操作（对未持久化的键是空操作），
 * 保证重复执行收敛：第二次运行 endpoint 已展开且键已删除，只剩幂等的删除。
 */
export function resolveCloudAiEndpointMigrationOutputs(
    reads: CloudAiEndpointMigrationReads,
): CloudAiEndpointMigrationOutput[] {
    const outputs: CloudAiEndpointMigrationOutput[] = [];
    if (reads.endpoint && reads.autoAppendV1 === 'true' && !/\/v1$/.test(reads.endpoint)) {
        outputs.push({ kind: 'set', key: 'apiKeys.openAi.endpoint', value: joinUrl(reads.endpoint, '/v1') });
    }
    outputs.push({ kind: 'delete', key: 'apiKeys.openAi.autoAppendV1' });
    return outputs;
}

export const storeSchemaCloudAiEndpointMigrationV3: CustomMigration = {
    id: MIGRATION_ID,
    description: 'Expand persisted cloud AI endpoint to full base URL and drop autoAppendV1 flag',
    run: async (ctx) => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: ctx.settings.getPersisted('apiKeys.openAi.endpoint'),
            autoAppendV1: ctx.settings.getPersisted('apiKeys.openAi.autoAppendV1'),
        });
        for (const output of outputs) {
            if (output.kind === 'set') {
                ctx.settings.set(output.key, output.value);
            } else {
                ctx.settings.delete(output.key);
            }
        }
    },
};
