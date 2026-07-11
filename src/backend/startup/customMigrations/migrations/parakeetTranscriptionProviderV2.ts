import Store from 'electron-store';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import type { CustomMigration } from '@/backend/startup/customMigrations/types';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

/**
 * 将已保存的本地 Whisper 引擎选择迁移为 Sherpa/Parakeet。
 * OpenAI 与未配置状态保持不变，旧 Whisper 模型文件不会被隐式删除。
 */
export const parakeetTranscriptionProviderV2: CustomMigration = {
    id: 'parakeet-transcription-provider-v2',
    description: 'Switch persisted local transcription provider from Whisper to Sherpa/Parakeet',
    run: async (): Promise<void> => {
        if (settingsStore.get('providers.transcription') === 'whisper') {
            settingsStore.set('providers.transcription', 'sherpa');
        }
    },
};
