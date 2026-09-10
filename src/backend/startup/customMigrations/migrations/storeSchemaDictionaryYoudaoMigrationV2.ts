import { eq } from 'drizzle-orm';

import { wordTranslates } from '@/backend/infrastructure/db/tables/wordTranslates';

import type { CustomMigration } from '../types';

const MIGRATION_ID = 'store-schema-dictionary-youdao-v2';

export const storeSchemaDictionaryYoudaoMigrationV2: CustomMigration = {
    id: MIGRATION_ID,
    description: 'Migrate dictionary engine youdao option to openai and clean up youdao leftovers',
    /**
     * 清理有道词典链路的存量数据。
     *
     * 配置读写走 ctx.settings 单例通道（同批迁移先前的写入对本迁移可见），
     * SQLite 清理走 ctx.db；两个存储无法包进同一事务，靠各步骤幂等
     * （条件写、重复删除无害）保证任意一步中断后重跑收敛。
     */
    run: async (ctx) => {
        // 有道词典链路已下线：存量配置中的 'youdao' 引擎切换为 'openai'。
        // 未配置 openai key 时词典模型不可用，但预置词典不依赖任何密钥，查询链路仍然可用。
        if (ctx.settings.getPersisted('providers.dictionary') === 'youdao') {
            ctx.settings.set('providers.dictionary', 'openai');
        }

        // 清理有道凭据键与有道来源的历史词典缓存行（provider 仅剩 'openai'，旧行永不再命中）。
        // 这两个键已从 schema 移除，只能用放宽类型的历史键删除。
        ctx.settings.delete('apiKeys.youdao.secretId');
        ctx.settings.delete('apiKeys.youdao.secretKey');

        const result = await ctx.db.delete(wordTranslates).where(eq(wordTranslates.provider, 'youdao'));
        ctx.logger.info('youdao word translate cache cleaned', { deleted: result.changes });
    },
};
