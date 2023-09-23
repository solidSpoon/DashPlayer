import { ChangeEvent, useEffect, useRef, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import { ShortCutValue } from '../../../components/GlobalShortCut';

const ShortcutSetting = () => {
    const [last, setLast] = useState<string>('');
    const [next, setNext] = useState<string>('');
    const [repeat, setRepeat] = useState<string>('');
    const [space, setSpace] = useState<string>('');
    const [serverValue, serServerValue] = useState<ShortCutValue | undefined>();

    const eqServer =
        serverValue?.last === last &&
        serverValue?.next === next &&
        serverValue?.repeat === repeat &&
        serverValue?.space === space;
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
                <div className="text-lg w-24">{title} :</div>
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
        <div className="w-full">
            <form className=" px-8 pt-6 pb-8 mb-4" onSubmit={handleSubmit}>
                <h1 className="text-2xl font-bold">快捷键</h1>
                <text className="text-gray-400">多个快捷键用 , 分割</text>
                <div className=" flex flex-col gap-5 mt-5 mb-5">
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
                </div>

                <div className="flex items-center justify-end">
                    <button
                        className={` text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-5 ${
                            eqServer
                                ? 'bg-gray-500'
                                : 'bg-blue-500 hover:bg-blue-700'
                        }`}
                        onClick={handleSubmit}
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
