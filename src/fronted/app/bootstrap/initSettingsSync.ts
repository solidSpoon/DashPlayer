import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { rendererEvents } from '@/fronted/infrastructure/electron/rendererEvents';
import useSetting from '@/fronted/features/settings/settingsStore';
import useTranslation from '@/fronted/features/player/translationStore';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import {
    RuntimeSettingKey,
    RuntimeSettingsSnapshot,
} from '@/common/contracts/runtime-settings';

/** 字幕翻译引擎的合法取值，需与后端 `providers.subtitleTranslation` 枚举保持一致。 */
const SUBTITLE_ENGINE_VALUES = ['openai', 'local', 'tencent', 'none'] as const;
type SubtitleEngine = (typeof SUBTITLE_ENGINE_VALUES)[number];

/**
 * 判断设置值是否为合法的字幕翻译引擎。
 *
 * @param value 待检查的设置值。
 * @returns 属于合法引擎枚举时返回 `true`。
 */
function isSubtitleEngine(value: string): value is SubtitleEngine {
    return (SUBTITLE_ENGINE_VALUES as readonly string[]).includes(value);
}

let cleanupFn: (() => void) | null = null;

/**
 * 初始化运行时设置快照和设置变化监听。
 *
 * @returns 清理设置监听并重置初始化状态的函数。
 */
export function initSettingsSync(): () => void {
    const logger = getRendererLogger('SettingsSync');

    if (cleanupFn) {
        logger.warn('settings sync already initialized');
        return cleanupFn;
    }

    backendClient.call('settings/runtime/detail').then((snapshot: RuntimeSettingsSnapshot) => {
        useSetting.getState().initialize(snapshot);
        const subtitleProvider = snapshot['providers.subtitleTranslation'];
        if (!isSubtitleEngine(subtitleProvider)) {
            throw new Error(`运行时字幕翻译引擎无效: ${subtitleProvider}`);
        }
        const subtitleMode = snapshot['features.openai.subtitleTranslationMode'];
        if (subtitleMode !== 'zh' && subtitleMode !== 'simple_en' && subtitleMode !== 'custom') {
            throw new Error(`运行时字幕翻译模式无效: ${subtitleMode}`);
        }
        useTranslation.getState().initializeRuntimeSettings(subtitleProvider, subtitleMode);
    }).catch((error) => {
        logger.error('failed to sync runtime settings', { error });
    });

    const unsubscribe = rendererEvents.onStoreUpdate((key: RuntimeSettingKey, value: string) => {
        const oldValue = useSetting.getState().values.get(key);
        if (oldValue !== value) {
            useSetting.getState().setLocalSetting(key, value);
        }

        if (key === 'providers.subtitleTranslation') {
            if (!isSubtitleEngine(value)) {
                logger.error('invalid subtitle translation provider', {value});
                return;
            }
            useTranslation.getState().setEngine(value);
        }

        if (key === 'features.openai.subtitleTranslationMode') {
            if (value !== 'zh' && value !== 'simple_en' && value !== 'custom') {
                logger.error('invalid OpenAI subtitle translation mode', {value});
                return;
            }
            useTranslation.getState().setOpenAiMode(value);
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
