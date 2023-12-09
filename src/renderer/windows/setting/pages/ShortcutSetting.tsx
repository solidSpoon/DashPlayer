import { useState } from 'react';
import SettingButton from '../../../components/setting/SettingButton';
import SettingInput from '../../../components/setting/SettingInput';
import ItemWrapper from '../../../components/setting/ItemWapper';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import Header from '../../../components/setting/Header';
import useNotification from '../../../hooks/useNotification';
import useSetting from '../../../hooks/useSetting';
import { defaultShortcut, ShortCutValue } from '../../../../types/SettingType';

const verify = (sc: ShortCutValue): string | null => {
    // 校验有没有重复的
    const set = new Set<string>();
    const keys = Object.keys(sc) as (keyof ShortCutValue)[];
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const value = sc[key];
        if (set.has(value)) {
            return value;
        }
        set.add(value);
    }
    return null;
};

const ShortcutSetting = () => {
    const keyBinds = useSetting((s) => s.keyBinds);
    const setKeyBinds = useSetting((s) => s.setKeyBinds);

    const [localKeyBindings, setLocalKeyBindings] =
        useState<ShortCutValue>(keyBinds);

    const setNotification = useNotification((s) => s.setNotification);

    const eqServer =
        JSON.stringify(keyBinds) === JSON.stringify(localKeyBindings);

    const update = (key: keyof ShortCutValue) => (value: string) => {
        setLocalKeyBindings((s) => ({ ...s, [key]: value }));
    };
    const handleSubmit = async () => {
        const res = verify(localKeyBindings);
        if (res) {
            // toast.error(`快捷键 ${res} 重复`, {
            setNotification({
                type: 'error',
                text: `快捷键 ${res} 重复`,
            });
            return;
        }
        setKeyBinds(localKeyBindings);
    };
    return (
        <form className=" h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <ItemWrapper>
                <SettingInput
                    title="上一句"
                    placeHolder={defaultShortcut.last}
                    value={localKeyBindings.last || ''}
                    setValue={update('last')}
                />
                <SettingInput
                    title="下一句"
                    placeHolder={defaultShortcut.next}
                    value={localKeyBindings.next || ''}
                    setValue={update('next')}
                />
                <SettingInput
                    title="重复"
                    placeHolder={defaultShortcut.repeat}
                    value={localKeyBindings.repeat || ''}
                    setValue={update('repeat')}
                />
                <SettingInput
                    title="播放/暂停"
                    placeHolder={defaultShortcut.space}
                    value={localKeyBindings.space || ''}
                    setValue={update('space')}
                />
                <SettingInput
                    title="单句重复"
                    placeHolder={defaultShortcut.singleRepeat}
                    value={localKeyBindings.singleRepeat || ''}
                    setValue={update('singleRepeat')}
                />
                <SettingInput
                    title="展示/隐藏英文"
                    placeHolder={defaultShortcut.showEn}
                    value={localKeyBindings.showEn || ''}
                    setValue={update('showEn')}
                />
                <SettingInput
                    title="展示/隐藏中文"
                    placeHolder={defaultShortcut.showCn}
                    value={localKeyBindings.showCn || ''}
                    setValue={update('showCn')}
                />
                <SettingInput
                    title="展示/隐藏中英"
                    placeHolder={defaultShortcut.sowEnCn}
                    value={localKeyBindings.sowEnCn || ''}
                    setValue={update('sowEnCn')}
                />
                <SettingInput
                    title="展示/隐藏生词翻译"
                    placeHolder={defaultShortcut.showWordLevel}
                    value={localKeyBindings.showWordLevel || ''}
                    setValue={update('showWordLevel')}
                />
                <SettingInput
                    title="上一个主题"
                    placeHolder={defaultShortcut.prevTheme}
                    value={localKeyBindings.prevTheme || ''}
                    setValue={update('prevTheme')}
                />
                <SettingInput
                    title="下一个主题"
                    placeHolder={defaultShortcut.nextTheme}
                    value={localKeyBindings.nextTheme || ''}
                    setValue={update('nextTheme')}
                />
            </ItemWrapper>

            <FooterWrapper>
                <SettingButton
                    handleSubmit={handleSubmit}
                    disabled={eqServer}
                />
            </FooterWrapper>
        </form>
    );
};
export default ShortcutSetting;
