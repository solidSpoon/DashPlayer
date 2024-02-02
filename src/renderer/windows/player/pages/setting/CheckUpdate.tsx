import { useEffect, useState } from 'react';
import { Release } from '../../../../../main/controllers/CheckUpdate';
import Header from '../../../../components/setting/Header';
import ItemWrapper from '../../../../components/setting/ItemWrapper';
import { SettingButton } from '../../../../components/setting';
import FooterWrapper from '../../../../components/setting/FooterWrapper';
import { cn } from '../../../../../common/utils/Util';

const api = window.electron;

const CheckUpdate = () => {
    const [newRelease, setNewRelease] = useState<Release[]>([]);

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
                {!checking && newRelease.length === 0 && (
                    <div className="text-lg">已经是最新版本</div>
                )}
                {!checking && newRelease.length > 0 && (
                    <div className="mr-6">
                        {newRelease.map((release) => (
                            <pre key={release.version}>
                                <h2 className="text-base mt-2">
                                    {release.version}
                                </h2>
                                <p className="text-sm mt-2">
                                    {release.content}
                                </p>
                            </pre>
                        ))}
                    </div>
                )}
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    handleSubmit={() => {
                        api.openUrl(
                                'https://github.com/solidSpoon/DashPlayer/releases/latest'
                        );
                    }}
                    disabled={false}
                >
                    前往发布页
                </SettingButton>
            </FooterWrapper>
        </div>
    );
};

export default CheckUpdate;
