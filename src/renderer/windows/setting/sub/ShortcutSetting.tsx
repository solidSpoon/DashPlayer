import { ChangeEvent, useEffect, useRef, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import { ShortCutValue } from '../../../components/GlobalShortCut';
import SettingButton from '../../../components/setting/SettingButton';
import SettingInput from '../../../components/setting/SettingInput';
import ItemWrapper from '../../../components/setting/ItemWapper';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import Header from '../../../components/setting/Header';
import useNotification from '../../../hooks/useNotification';

export const defaultShortcut: ShortCutValue = {
    last: 'left,a',
    next: 'right,d',
    repeat: 'down,s',
    space: 'space,up,w',
    singleRepeat: 'r',
    showEn: 'e',
    showCn: 'c',
    sowEnCn: 'b',
    nextTheme: 't',
    prevTheme: 'r',
};

// function notify(res: string) {
//     const notification = new Notification('快捷键重复', {
//         body: `快捷键 ${res} 重复`,
//     });
//     notification.onclick = () => {
//         window.focus();
//     };
// }

const ShortcutSetting = () => {
    const [last, setLast] = useState<string>('');
    const [next, setNext] = useState<string>('');
    const [repeat, setRepeat] = useState<string>('');
    const [space, setSpace] = useState<string>('');
    const [singleRepeat, setSingleRepeat] = useState<string>('');
    const [showEn, setShowEn] = useState<string>('');
    const [showCn, setShowCn] = useState<string>('');
    const [showEnCn, setShowEnCn] = useState<string>('');
    const [nextTheme, setNextTheme] = useState<string>('');
    const [prevTheme, setPrevTheme] = useState<string>('');

    const [serverValue, serServerValue] = useState<ShortCutValue | undefined>();

    const setNotification = useNotification((s) => s.setNotification);
    const eqServer =
        serverValue?.last === last &&
        serverValue?.next === next &&
        serverValue?.repeat === repeat &&
        serverValue?.space === space &&
        serverValue?.singleRepeat === singleRepeat &&
        serverValue?.showEn === showEn &&
        serverValue?.showCn === showCn &&
        serverValue?.sowEnCn === showEnCn &&
        serverValue?.nextTheme === nextTheme &&
        serverValue?.prevTheme === prevTheme;
    const updateFromServer = async () => {
        let newVar = (await callApi('get-shortcut', [])) as string;
        if (!newVar || newVar === '') {
            newVar = JSON.stringify(defaultShortcut);
            await callApi('update-shortcut', [newVar]);
        }
        const sc: ShortCutValue = JSON.parse(newVar);
        setLast(sc.last);
        setNext(sc.next);
        setRepeat(sc.repeat);
        setSpace(sc.space);
        setSingleRepeat(sc.singleRepeat);
        setShowEn(sc.showEn);
        setShowCn(sc.showCn);
        setShowEnCn(sc.sowEnCn);
        setNextTheme(sc.nextTheme);
        setPrevTheme(sc.prevTheme);
        serServerValue(sc);
    };
    useEffect(() => {
        updateFromServer();
    }, []);

    const process = (base: string | undefined, def: string) => {
        let baseStr = (base ?? '').trim();
        baseStr = baseStr
            .split(',')
            .filter((item) => item.trim() !== '')
            .join(',');
        if (baseStr.trim() === '') {
            return def;
        }
        return baseStr.replaceAll(' ', '');
    };
    const verify = (sc: ShortCutValue): string | null => {
        // 校验有没有重复的
        const arr = [
            sc.last,
            sc.next,
            sc.repeat,
            sc.space,
            sc.singleRepeat,
            sc.showEn,
            sc.showCn,
            sc.sowEnCn,
            sc.nextTheme,
            sc.prevTheme,
        ];
        const set = new Set<string>();
        // eslint-disable-next-line no-restricted-syntax
        for (const item of arr) {
            const items = item.split(',');
            // eslint-disable-next-line no-restricted-syntax
            for (const i of items) {
                if (i.trim() !== '') {
                    if (set.has(i)) {
                        return i;
                    }
                    set.add(i);
                }
            }
        }
        return null;
    };
    const handleSubmit = async () => {
        const sc: ShortCutValue = {
            last: process(last, defaultShortcut.last),
            next: process(next, defaultShortcut.next),
            repeat: process(repeat, defaultShortcut.repeat),
            space: process(space, defaultShortcut.space),
            singleRepeat: process(singleRepeat, defaultShortcut.singleRepeat),
            showEn: process(showEn, defaultShortcut.showEn),
            showCn: process(showCn, defaultShortcut.showCn),
            sowEnCn: process(showEnCn, defaultShortcut.sowEnCn),
            nextTheme: process(nextTheme, defaultShortcut.nextTheme),
            prevTheme: process(prevTheme, defaultShortcut.prevTheme),
        };
        const res = verify(sc);
        if (res) {
            // toast.error(`快捷键 ${res} 重复`, {
            setNotification({
                type: 'error',
                text: `快捷键 ${res} 重复`,
            });
            return;
        }

        await callApi('update-shortcut', [JSON.stringify(sc)]);
        await updateFromServer();
    };
    return (
        <form className=" h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <ItemWrapper>
                <SettingInput
                    title="上一句"
                    placeHolder={defaultShortcut.last}
                    value={last || ''}
                    setValue={setLast}
                />
                <SettingInput
                    title="下一句"
                    placeHolder={defaultShortcut.next}
                    value={next || ''}
                    setValue={setNext}
                />
                <SettingInput
                    title="重复"
                    placeHolder={defaultShortcut.repeat}
                    value={repeat || ''}
                    setValue={setRepeat}
                />
                <SettingInput
                    title="播放/暂停"
                    placeHolder={defaultShortcut.space}
                    value={space || ''}
                    setValue={setSpace}
                />
                <SettingInput
                    title="单句重复"
                    placeHolder={defaultShortcut.singleRepeat}
                    value={singleRepeat || ''}
                    setValue={setSingleRepeat}
                />
                <SettingInput
                    title="展示/隐藏英文"
                    placeHolder={defaultShortcut.showEn}
                    value={showEn || ''}
                    setValue={setShowEn}
                />
                <SettingInput
                    title="展示/隐藏中文"
                    placeHolder={defaultShortcut.showCn}
                    value={showCn || ''}
                    setValue={setShowCn}
                />
                <SettingInput
                    title="展示/隐藏中英"
                    placeHolder={defaultShortcut.sowEnCn}
                    value={showEnCn || ''}
                    setValue={setShowEnCn}
                />
                <SettingInput
                    title="上一个主题"
                    placeHolder={defaultShortcut.prevTheme}
                    value={nextTheme || ''}
                    setValue={setPrevTheme}
                />
                <SettingInput
                    title="下一个主题"
                    placeHolder={defaultShortcut.nextTheme}
                    value={prevTheme || ''}
                    setValue={setNextTheme}
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
