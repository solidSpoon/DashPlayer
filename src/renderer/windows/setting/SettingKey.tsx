import { ChangeEvent, Component, FormEvent, useEffect, useState } from 'react';
import 'tailwindcss/tailwind.css';
import callApi from '../../lib/apis/ApiWrapper';
import TenantSetting from './sub/TenantSetting';
import YouDaoSetting from './sub/YouDaoSetting';
import ShortcutSetting from './sub/ShortcutSetting';
import TitleBarSettingWindows from '../../components/TitleBarSettingWindows';
import './SettingKey.css';
import StorageSetting from './sub/StorageSetting';

type SettingType = 'you-dao' | 'tenant' | 'shortcut' | 'storage';

export default function SettingKey() {
    const [settingType, setSettingType] = useState<SettingType>('shortcut');
    const [isWindows, setIsWindows] = useState<boolean>(false);

    useEffect(() => {
        const fun = async () => {
            const isW = (await callApi('is-windows', [])) as boolean;
            setIsWindows(isW);
            console.log('isw', isW);
        };
        fun();
    }, []);

    const ele = (name: string, key: SettingType) => {
        return (
            <ul
                onClick={() => setSettingType(key)}
                className={`flex flex-col overflow-hidden bg-gray-100 shadow py-1 px-5 rounded-lg
                            ${
                                settingType === key
                                    ? 'bg-blue-500 hover:bg-blue-400'
                                    : 'hover:bg-blue-200'
                            }
                            `}
            >
                {name}
            </ul>
        );
    };

    return (
        <div className="w-full h-screen flex flex-col mx-auto bg-gray-200 overflow-hidden">
            {isWindows && <TitleBarSettingWindows />}
            <div className="flex flex-row flex-1 h-0">
                <aside className="w-1/3 select-none">
                    <div className="sticky top-0 p-4 pt-6 w-full flex flex-col gap-2">
                        {ele('快捷键', 'shortcut')}
                        {ele('腾讯密钥', 'tenant')}
                        {ele('有道密钥', 'you-dao')}
                        {ele('存储', 'storage')}
                    </div>
                </aside>
                <main role="main" className="w-0 flex-1 pt-1 px-2 h-full ">
                    {settingType === 'tenant' && <TenantSetting />}
                    {settingType === 'you-dao' && <YouDaoSetting />}
                    {settingType === 'shortcut' && <ShortcutSetting />}
                    {settingType === 'storage' && <StorageSetting />}
                </main>
            </div>
        </div>
    );
}
