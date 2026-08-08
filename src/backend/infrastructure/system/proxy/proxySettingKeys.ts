import { SettingKey } from '@/common/types/store_schema';

/** 代理功能相关的设置项 key，任意一项变化都需要重新应用代理。 */
export const PROXY_SETTING_KEYS: SettingKey[] = ['proxy.mode', 'proxy.url', 'proxy.bypass_rules'];
