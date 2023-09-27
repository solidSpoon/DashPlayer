import { ChangeEvent, useEffect, useRef, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import { ShortCutValue } from '../../../components/GlobalShortCut';

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
        const newVar = (await callApi('get-shortcut', [])) as string;
        if (!newVar || newVar === '') {
            return;
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

    const handleSubmit = async () => {
        const sc: ShortCutValue = {
            last: last ?? '',
            next: next ?? '',
            repeat: repeat ?? '',
            space: space ?? '',
            singleRepeat: singleRepeat ?? '',
            showEn: showEn ?? '',
            showCn: showCn ?? '',
            sowEnCn: showEnCn ?? '',
        };
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
        <div className="w-full h-screen overflow-y-auto">
            <form className=" px-8 pt-6 pb-8 mb-4" onSubmit={handleSubmit}>
                <div className="sticky top-0 bg-gray-200/95">
                    <h1 className="text-2xl font-bold">快捷键</h1>
                    <text className="">多个快捷键用 , 分割</text>
                </div>
                <div className=" flex flex-col gap-5 mt-6 mb-5">
                    {itemEle('上一句', 'last', 'left,a', last || '', setLast)}
                    {itemEle('下一句', 'next', 'right,d', next || '', setNext)}
                    {itemEle(
                        '重复',
                        'repeat',
                        'down,s',
                        repeat || '',
                        setRepeat
                    )}
                    {itemEle(
                        '播放/暂停',
                        'space',
                        'space,up,w',
                        space || '',
                        setSpace
                    )}
                    {itemEle(
                        '单句重复',
                        'repeatSingle',
                        'r',
                        singleRepeat || '',
                        setSingleRepeat
                    )}
                    {itemEle(
                        '展示/隐藏英文',
                        'showEn',
                        'e',
                        showEn || '',
                        setShowEn
                    )}
                    {itemEle(
                        '展示/隐藏中文',
                        'showCn',
                        'c',
                        showCn || '',
                        setShowCn
                    )}
                    {itemEle(
                        '展示/隐藏中英',
                        'showEnCn',
                        'b',
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
        </div>
    );
};
export default ShortcutSetting;
