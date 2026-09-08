import Store from 'electron-store';
import { eq } from 'drizzle-orm';

import db from '@/backend/infrastructure/db';
import { wordTranslates } from '@/backend/infrastructure/db/tables/wordTranslates';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import { storeSet } from '@/backend/infrastructure/settings/store';

const MIGRATION_ID = 'store-schema-dictionary-youdao-v2';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

export const storeSchemaDictionaryYoudaoMigrationV2 = {
    id: MIGRATION_ID,
    description: 'Migrate dictionary engine youdao option to openai and clean up youdao leftovers',
    run: async (): Promise<void> => {
        // 有道词典链路已下线：存量配置中的 'youdao' 引擎切换为 'openai'。
        // 未配置 openai key 时词典模型不可用，但预置词典不依赖任何密钥，查询链路仍然可用。
        const persistedDictionaryProvider = settingsStore.get('providers.dictionary');
        if (persistedDictionaryProvider === 'youdao') {
            storeSet('providers.dictionary', 'openai');
        }

        // 清理有道凭据键与有道来源的历史词典缓存行（provider 仅剩 'openai'，旧行永不再命中）。
        settingsStore.delete('apiKeys.youdao.secretId');
        settingsStore.delete('apiKeys.youdao.secretKey');

        await db.delete(wordTranslates).where(eq(wordTranslates.provider, 'youdao'));
    },
};
