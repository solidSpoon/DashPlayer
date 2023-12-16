import { useEffect, useState } from 'react';
import { Release } from '../../../../main/controllers/CheckUpdate';
import Header from '../../../components/setting/Header';
import ItemWrapper from '../../../components/setting/ItemWrapper';
import { SettingButton } from '../../../components/setting';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import { cn } from '../../../../utils/Util';

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
        <div className="w-full h-full flex flex-col gap-4">
            <Header title="检查更新" />
            <ItemWrapper>
                {checking && <div>检查更新中...</div>}
                {!checking && !newRelease && (
                    <div className="text-lg">已经是最新版本</div>
                )}
                {!checking && newRelease && (
                    <div className="mr-6">
                        <h1 className="text-lg">
                            最新版本: {newRelease.version}
                        </h1>
                        <pre
                            className={cn(
                                'mt-4 border rounded-lg border-gray-300 p-2 select-text bg-white text-sm'
                            )}
                        >
                            {newRelease.content}
                        </pre>
                    </div>
                )}
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    handleSubmit={() => {
                        api.openUrl(
                            newRelease?.url ??
                                'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                    disabled={false}
                    text="前往发布页"
                />
            </FooterWrapper>
        </div>
    );
};

export default CheckUpdate;
