import useSetting from "./useSetting";
import { useEffect, useState } from "react";
import { SettingKey } from "../../common/types/store_schema";

const useSettingForm = (keys: SettingKey[]) => {
    const setting = useSetting(s=>s.setting);
    const setSetting = useSetting(s=>s.setSetting);
    const [localSettingValue, setLocalSettingValue] = useState<Map<SettingKey, string>>(new Map());
    useEffect(() => {
        const newLocalSettingValue = new Map<SettingKey, string>();
        keys.forEach(key => {
            newLocalSettingValue.set(key, setting(key));
        });
        setLocalSettingValue(newLocalSettingValue);
    }, []);
    const localSetting = (key: SettingKey) => {
        return localSettingValue.get(key) ?? '';
    }
    const setLocalSetting = (key: SettingKey, value: string) => {
        setLocalSettingValue(new Map(localSettingValue).set(key, value));
    }

    const setLocalFunc = (key: SettingKey) : ((value: string) => void) => {
        return setLocalSetting.bind(null, key);
    }

    const eqServer = keys.every(key => setting(key) === localSetting(key));
    const submit = () => {
        keys.filter(key => setting(key) !== localSetting(key))
            .forEach(key => {
            setSetting(key, localSetting(key));
        });
    }

    return {
        setting: localSetting,
        setSetting: setLocalSetting,
        setSettingFunc: setLocalFunc,
        eqServer,
        submit,
    }
}

export default useSettingForm;
