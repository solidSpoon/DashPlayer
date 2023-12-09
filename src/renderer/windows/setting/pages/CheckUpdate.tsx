import { useEffect, useState } from 'react';
import { Release } from '../../../../main/controllers/CheckUpdate';
import Header from '../../../components/setting/Header';
import ItemWrapper from '../../../components/setting/ItemWapper';
import useNotification from '../../../hooks/useNotification';

const api = window.electron;

const CheckUpdate = () => {
    const [newRelease, setNewRelease] = useState<Release | undefined>(
        undefined
    );

    const [checking, setChecking] = useState<boolean>(true);
    const setNotification = useNotification((s) => s.setNotification);

    useEffect(() => {
        const fun = async () => {
            const nr = await api.checkUpdate();
            setNewRelease(nr);
            setChecking(false);
        };
        fun();
    }, []);

    const handleClick = async () => {
        setNotification({
            type: 'info',
            text: 'copied',
        });
        await api.writeToClipboard(newRelease?.url ?? '');
    };

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <Header title="检查更新" />
            <ItemWrapper>
                {checking && <div>检查更新中...</div>}
                {!checking && !newRelease && (
                    <div className="text-lg">已经是最新版本</div>
                )}
                {!checking && newRelease && (
                    <div className="">
                        <h1 className="text-lg">
                            最新版本: {newRelease.version}
                        </h1>
                        <div className="pt-2 text-base">
                            前往如下地址下载新版
                        </div>
                        <div
                            className="text-sm select-all"
                            onClick={() => {
                                handleClick();
                            }}
                        >
                            {newRelease.url}
                        </div>
                    </div>
                )}
            </ItemWrapper>
        </div>
    );
};

export default CheckUpdate;
