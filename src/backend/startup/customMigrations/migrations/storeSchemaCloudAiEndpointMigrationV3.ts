import { joinUrl } from '@/common/utils/Util';

import type { CustomMigration } from '../types';

const MIGRATION_ID = 'store-schema-cloud-ai-endpoint-v3';

/** 迁移需要读取的持久化键值。 */
export interface CloudAiEndpointMigrationReads {
    /** 持久化的云端接口地址；未持久化过为 null。 */
    endpoint: string | null;
    /** 旧版「自动追加 /v1」开关的持久化值；未持久化过为 null。 */
    autoAppendV1: string | null;
}

/** 迁移产出的单个写入项：接口地址键固定，只产出「展开为完整 base URL」一种动作。 */
export interface CloudAiEndpointMigrationOutput {
    key: 'apiKeys.openAi.endpoint';
    value: string;
}

/**
 * 计算云端接口地址迁移的写入项（纯函数，便于单测）。
 *
 * 存储语义从「地址（不含 /v1）+ 是否自动追加 /v1 开关」改为「完整 base URL 直存」，
 * 因此要把历史地址展开成带版本路径的完整地址。判定放宽到「开关未被显式关闭」：
 * 2026-08-14 引入开关之前，运行期是无条件 joinUrl(endpoint, '/v1')，这类用户
 * 从未持久化过自动追加开关（读出来是 null），只认 'true' 会漏掉他们——而漏掉意味着
 * 升级后接口地址缺 /v1，请求直接 404。已以 /v1 结尾的地址不再追加，避免 /v1/v1。
 *
 * 不产出删除旧开关键的操作：该键已被 schema 移除，留着它才能让「跑到一半崩溃后重跑」
 * 收敛——地址展开后已带 /v1，第二次运行自然为空写入。若在此删除开关，重跑时读到的
 * 是 null，对显式关闭过开关的用户会错误地补上 /v1。
 *
 * @param reads 旧配置线索（均为真实持久化过的原始串）。
 * @returns 需要写入的键值项；无需变更时为空数组。
 */
export const resolveCloudAiEndpointMigrationOutputs = (
    reads: CloudAiEndpointMigrationReads,
): CloudAiEndpointMigrationOutput[] => {
    const { endpoint, autoAppendV1 } = reads;
    if (!endpoint) {
        return [];
    }
    if (autoAppendV1 === 'false') {
        return [];
    }
    if (/\/v1$/.test(endpoint)) {
        return [];
    }
    return [{ key: 'apiKeys.openAi.endpoint', value: joinUrl(endpoint, '/v1') }];
};

export const storeSchemaCloudAiEndpointMigrationV3: CustomMigration = {
    id: MIGRATION_ID,
    description: 'Expand persisted cloud AI endpoint to full base URL including the version path',
    /**
     * 把历史云端接口地址展开为含版本路径的完整 base URL。
     *
     * 读写只走 ctx.settings 单例通道；决策收敛在纯函数里，产出为空时不写任何键。
     */
    run: async (ctx) => {
        const outputs = resolveCloudAiEndpointMigrationOutputs({
            endpoint: ctx.settings.getPersisted('apiKeys.openAi.endpoint'),
            autoAppendV1: ctx.settings.getPersisted('apiKeys.openAi.autoAppendV1'),
        });
        for (const { key, value } of outputs) {
            ctx.settings.set(key, value);
        }
        ctx.logger.info('cloud ai endpoint migration applied', {
            writtenKeys: outputs.map((output) => output.key),
        });
    },
};
