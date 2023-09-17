import { ChangeEvent, Component, FormEvent, useState } from 'react';
import 'tailwindcss/tailwind.css';
import callApi from '../../lib/apis/ApiWrapper';
import TenantSetting from './sub/TenantSetting';
import YouDaoSetting from './sub/YouDaoSetting';

type SettingType = 'you-dao' | 'tenant';
export default function () {
    const [settingType, setSettingType] = useState<SettingType>('tenant');
    return (
        <div className="container mx-auto">
            <div className="flex flex-row flex-wrap py-4">
                <aside className="w-1/3 select-none">
                    <div className="sticky top-0 p-4 w-full flex flex-col gap-2">
                        <ul
                            onClick={() => setSettingType('tenant')}
                            className={`flex flex-col overflow-hidden bg-gray-100 shadow hover:bg-blue-500 py-1 px-5 rounded-lg
                            ${settingType === 'tenant' ? 'bg-blue-500' : ''}
                            `}
                        >
                            腾讯密钥
                        </ul>
                        <ul
                            onClick={() => setSettingType('you-dao')}
                            className={`flex flex-col overflow-hidden bg-gray-100 shadow hover:bg-blue-500 py-1 px-5 rounded-lg
                            ${settingType === 'you-dao' ? 'bg-blue-500' : ''}`}
                        >
                            有道密钥
                        </ul>
                    </div>
                </aside>
                <main role="main" className="w-2/3 pt-1 px-2 ">
                    {settingType === 'tenant' && <TenantSetting />}
                    {settingType === 'you-dao' && <YouDaoSetting />}
                </main>
            </div>
        </div>
    );
}
