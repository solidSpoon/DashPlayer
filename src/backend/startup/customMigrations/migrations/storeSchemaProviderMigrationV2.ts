import Store from 'electron-store';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import { storeSet } from '@/backend/infrastructure/settings/store';

const MIGRATION_ID = 'store-schema-provider-v2';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

const getPersistedString = (key: string): string | null => {
    const value = settingsStore.get(key);
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const storeSchemaProviderMigrationV2 = {
    id: MIGRATION_ID,
    description: 'Sanitize invalid provider engines from store (e.g., groq) to prevent UI crash',
    run: async (): Promise<void> => {
        const subtitle = getPersistedString('providers.subtitleTranslation');
        if (subtitle && !['openai', 'tencent', 'none'].includes(subtitle)) {
            storeSet('providers.subtitleTranslation', 'none');
        }

        const dictionary = getPersistedString('providers.dictionary');
        if (dictionary && !['openai', 'youdao', 'none'].includes(dictionary)) {
            storeSet('providers.dictionary', 'none');
        }

        const transcription = getPersistedString('providers.transcription');
        if (transcription && !['openai', 'whisper', 'none'].includes(transcription)) {
            storeSet('providers.transcription', 'none');
        }
    },
};
