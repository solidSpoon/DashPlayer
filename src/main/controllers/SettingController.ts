import KeyValueCache from '../ServerLib/KeyValueCache';
import TransApi from '../ServerLib/TransApi';
import { SettingState } from '../../renderer/hooks/useSetting';
import { DEFAULT_SETTING } from '../../types/SettingType';

export async function updateSetting(setting: SettingState): Promise<void> {
    await KeyValueCache.updateValue('setting', JSON.stringify(setting));
    await TransApi.init(
        setting.tencentSecret.secretId ?? '',
        setting.tencentSecret.secretKey ?? ''
    );
}
export async function getSetting(): Promise<SettingState> {
    const settingStr = await KeyValueCache.queryValue('setting');
    if (!settingStr) {
        return DEFAULT_SETTING;
    }
    return JSON.parse(settingStr) as SettingState;
}
