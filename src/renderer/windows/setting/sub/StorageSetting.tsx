import { ChangeEvent, useEffect, useRef, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import { ShortCutValue } from '../../../components/GlobalShortCut';

const api = window.electron;
const StorageSetting = () => {
    const [size, setSize] = useState<string>('0 KB');

    useEffect(() => {
        const init = async () => {
            const s = await api.queryCacheSize();
            setSize(s);
        };
        init();
    }, []);

    const handleClear = async () => {
        await api.clearCache();
        const s = await api.queryCacheSize();
        setSize(s);
    };

    const handleOpen = async () => {
        await api.openDataFolder();
    };

    return (
        <div className="w-full px-10 pt-6 pb-8 mb-4">
            <h1 className="text-2xl font-bold">存储</h1>
            <text>
                DashPlayer 会缓存翻译结果，以降低 API 调用成本。
                <br />
                缓存文件由数据库软件维护，请不要编辑缓存文件。
            </text>
            <div className="flex flex-col gap-4">
                <div className="mt-4 flex text-lg flex-row items-center gap-2">
                    <text>占用空间</text>
                    <text>{size}</text>
                </div>
                <button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={handleOpen}
                >
                    打开缓存文件夹
                </button>
                <button
                    type="button"
                    className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                    disabled
                    onClick={handleClear}
                >
                    清除一个月前的缓存
                </button>
            </div>
        </div>
    );
};
export default StorageSetting;
