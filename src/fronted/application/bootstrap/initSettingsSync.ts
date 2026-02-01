import { SettingKey, SettingKeyObj } from '@/common/types/store_schema';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { storeEvents } from '@/fronted/application/bootstrap/storeEvents';
import useSetting from '@/fronted/hooks/useSetting';
import useTranslation from '@/fronted/hooks/useTranslation';
import type { TranslationMode } from '@/common/types/TranslationResult';
import { getRendererLogger } from '@/fronted/log/simple-logger';

let cleanupFn: (() => void) | null = null;

export function initSettingsSync(): () => void {
    const logger = getRendererLogger('SettingsSync');

    if (cleanupFn) {
        logger.warn('settings sync already initialized');
        return cleanupFn;
    }

    for (const key in SettingKeyObj) {
        const settingKey = key as SettingKey;
        backendClient.call('storage/get', settingKey).then((value: string) => {
            useSetting.getState().setLocalSetting(settingKey, value);
        }).catch((error) => {
            logger.error('failed to sync initial setting', { key: settingKey, error });
        });
    }

    backendClient.call('storage/get', 'feature.subtitleTranslation.provider').then((provider: string) => {
        const normalized = provider === 'openai' || provider === 'tencent' ? provider : 'disabled';
        useTranslation.getState().setEngine(normalized);
    }).catch((error) => {
        logger.error('failed to sync feature.subtitleTranslation.provider', { error });
    });

    backendClient.call('storage/get', 'feature.subtitleTranslation.openai.mode').then((mode: string) => {
        const normalized: TranslationMode = mode === 'simple_en' || mode === 'custom' ? mode : 'zh';
        useTranslation.getState().setOpenAiMode(normalized);
    }).catch((error) => {
        logger.error('failed to sync feature.subtitleTranslation.openai.mode', { error });
    });

    const unsubscribe = storeEvents.onStoreUpdate((key: SettingKey, value: string) => {
        const oldValue = useSetting.getState().values.get(key);
        if (oldValue !== value) {
            useSetting.getState().setLocalSetting(key, value);
        }

        if (key === 'feature.subtitleTranslation.provider') {
            const normalized = value === 'openai' || value === 'tencent' ? value : 'disabled';
            useTranslation.getState().setEngine(normalized);
        }

        if (key === 'feature.subtitleTranslation.openai.mode') {
            const normalized: TranslationMode = value === 'simple_en' || value === 'custom' ? value : 'zh';
            useTranslation.getState().setOpenAiMode(normalized);
        }
    });

    cleanupFn = () => {
        unsubscribe();
        cleanupFn = null;
        logger.info('settings sync stopped');
    };

    logger.info('settings sync started');
    return cleanupFn;
}
