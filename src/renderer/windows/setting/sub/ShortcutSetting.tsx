import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { white } from 'chalk';
import callApi from '../../../lib/apis/ApiWrapper';
import { ShortCutValue } from '../../../components/GlobalShortCut';

export const defaultShortcut: ShortCutValue = {
    last: 'left,a',
    next: 'right,d',
    repeat: 'down,s',
    space: 'space,up,w',
    singleRepeat: 'r',
    showEn: 'e',
    showCn: 'c',
    sowEnCn: 'b',
};

function notify(res: string) {
    const notification = new Notification('快捷键重复', {
        body: `快捷键 ${res} 重复`,
    });
    notification.onclick = () => {
        window.focus();
    };
}

const ShortcutSetting = () => {
    const [last, setLast] = useState<string>('');
    const [next, setNext] = useState<string>('');
    const [repeat, setRepeat] = useState<string>('');
    const [space, setSpace] = useState<string>('');
    const [singleRepeat, setSingleRepeat] = useState<string>('');
    const [showEn, setShowEn] = useState<string>('');
    const [showCn, setShowCn] = useState<string>('');
    const [showEnCn, setShowEnCn] = useState<string>('');

    const [serverValue, serServerValue] = useState<ShortCutValue | undefined>();

    const eqServer =
        serverValue?.last === last &&
        serverValue?.next === next &&
        serverValue?.repeat === repeat &&
        serverValue?.space === space &&
        serverValue?.singleRepeat === singleRepeat &&
        serverValue?.showEn === showEn &&
        serverValue?.showCn === showCn &&
        serverValue?.sowEnCn === showEnCn;
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
        };
        const res = verify(sc);
        if (res) {
            notify(res);
            return;
        }

        await callApi('update-shortcut', [JSON.stringify(sc)]);
        await updateFromServer();
    };

    const itemEle = (
        title: string,
        id: string,
        placeHolder: string,
        value: string,
        setValue: (value: string) => void
    ) => {
        return (
            <label
                className="flex items-center gap-4  text-gray-700 text-sm font-bold select-none"
                htmlFor={id}
            >
                <div className="text-lg w-32">{title} :</div>
                <input
                    className="shadow appearance-none border rounded flex-1 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    id={id}
                    type="text"
                    placeholder={placeHolder}
                    value={value || ''}
                    onChange={(event) => setValue(event.target.value)}
                />
            </label>
        );
    };

    return (
        <form
            className="h-full overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-stone-400 scrollbar-thumb-rounded-sm"
            onSubmit={handleSubmit}
        >
            <h1 className="text-2xl font-bold">快捷键</h1>
            <text className="">多个快捷键用 , 分割</text>

            <div className=" flex flex-col gap-5 pb-5 pt-6">
                {itemEle(
                    '上一句',
                    'last',
                    defaultShortcut.last,
                    last || '',
                    setLast
                )}
                {itemEle(
                    '下一句',
                    'next',
                    defaultShortcut.next,
                    next || '',
                    setNext
                )}
                {itemEle(
                    '重复',
                    'repeat',
                    defaultShortcut.repeat,
                    repeat || '',
                    setRepeat
                )}
                {itemEle(
                    '播放/暂停',
                    'space',
                    defaultShortcut.space,
                    space || '',
                    setSpace
                )}
                {itemEle(
                    '单句重复',
                    'repeatSingle',
                    defaultShortcut.singleRepeat,
                    singleRepeat || '',
                    setSingleRepeat
                )}
                {itemEle(
                    '展示/隐藏英文',
                    'showEn',
                    defaultShortcut.showEn,
                    showEn || '',
                    setShowEn
                )}
                {itemEle(
                    '展示/隐藏中文',
                    'showCn',
                    defaultShortcut.showCn,
                    showCn || '',
                    setShowCn
                )}
                {itemEle(
                    '展示/隐藏中英',
                    'showEnCn',
                    defaultShortcut.sowEnCn,
                    showEnCn || '',
                    setShowEnCn
                )}
            </div>

            <div className="flex items-center justify-end">
                <button
                    className="text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-5
                        disabled:bg-gray-500 bg-blue-500 hover:bg-blue-700"
                    onClick={handleSubmit}
                    disabled={eqServer}
                    type="button"
                >
                    Apply
                </button>
            </div>
        </form>
    );
};
export default ShortcutSetting;
