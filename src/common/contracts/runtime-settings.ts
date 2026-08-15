import { SettingKey } from '@/common/types/store_schema';

/**
 * 渲染进程运行时确实需要读取的非敏感设置键。
 */
export const runtimeSettingKeys = [
    'shortcut.previousSentence',
    'shortcut.nextSentence',
    'shortcut.repeatSentence',
    'shortcut.playPause',
    'shortcut.repeatSingleSentence',
    'shortcut.autoPause',
    'shortcut.toggleEnglishDisplay',
    'shortcut.toggleChineseDisplay',
    'shortcut.toggleWordLevelDisplay',
    'shortcut.toggleBilingualDisplay',
    'shortcut.nextTheme',
    'shortcut.adjustBeginMinus',
    'shortcut.adjustBeginPlus',
    'shortcut.adjustEndMinus',
    'shortcut.adjustEndPlus',
    'shortcut.clearAdjust',
    'shortcut.nextPlaybackRate',
    'shortcut.aiChat',
    'shortcut.addClip',
    'shortcut.openControlPanel',
    'userSelect.playbackRateStack',
    'providers.subtitleTranslation',
    'providers.dictionary',
    'features.openai.subtitleTranslationMode',
    'appearance.theme',
    'appearance.fontSize',
    'i18n.language',
    'player.autoPlayNext',
] as const satisfies readonly SettingKey[];

/**
 * 渲染进程运行时可见的设置键。
 */
export type RuntimeSettingKey = typeof runtimeSettingKeys[number];

/**
 * 播放器运行期间允许直接修改的设置键。
 */
export type RuntimeWritableSettingKey =
    | 'appearance.theme'
    | 'player.autoPlayNext'
    | 'userSelect.playbackRateStack';

/**
 * 渲染进程启动时使用的完整非敏感设置快照。
 */
export type RuntimeSettingsSnapshot = Record<RuntimeSettingKey, string>;

/**
 * 保存单个运行时设置的请求。
 */
export interface RuntimeSettingSaveRequest {
    /** 允许在播放器运行期间直接修改的设置键。 */
    key: RuntimeWritableSettingKey;
    /** 已序列化的设置值。 */
    value: string;
}

/**
 * 判断设置键是否允许同步到渲染进程。
 *
 * @param key 待检查的配置仓库键。
 * @returns 属于运行时非敏感设置集合时返回 `true`。
 */
export function isRuntimeSettingKey(key: SettingKey): key is RuntimeSettingKey {
    return (runtimeSettingKeys as readonly SettingKey[]).includes(key);
}
