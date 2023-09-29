import { ChangeEvent, useEffect, useState } from 'react';
import { Release } from '../../../../main/controllers/CheckUpdate';

const api = window.electron;

const CheckUpdate = () => {
    const [newRelease, setNewRelease] = useState<Release | undefined>(
        undefined
    );

    const [checking, setChecking] = useState<boolean>(true);

    useEffect(() => {
        const fun = async () => {
            const nr = await api.checkUpdate();
            setNewRelease(nr);
            setChecking(false);
        };
        fun();
    }, []);

    return (
        <div className="w-full h-full p-8">
            {checking && <div>检查更新中...</div>}
            {!checking && !newRelease && <div>已经是最新版本</div>}
            {!checking && newRelease && (
                <div>
                    <h1 className="text-2xl">最新版本: {newRelease.version}</h1>
                    <div className="pt-2">前往如下地址下载新版</div>
                    <div
                        onClick={() => {
                            api.openUrl(newRelease.url);
                        }}
                        className=""
                    >
                        {newRelease.url}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckUpdate;
