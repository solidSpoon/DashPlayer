import { useState } from 'react';
import SettingButton from '../../../components/setting/SettingButton';
import SettingInput from '../../../components/setting/SettingInput';
import ItemWrapper from '../../../components/setting/ItemWapper';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import Header from '../../../components/setting/Header';
import useSetting, { Secret } from '../../../hooks/useSetting';

const TenantSetting = () => {
    const tencentSecret = useSetting((s) => s.tencentSecret);
    const setTencentSecret = useSetting((s) => s.setTencentSecret);
    const [localTencentSecret, setLocalTencentSecret] =
        useState<Secret>(tencentSecret);

    const eqServer =
        JSON.stringify(tencentSecret) === JSON.stringify(localTencentSecret);
    const update = (key: keyof Secret) => (value: string) => {
        setLocalTencentSecret((s) => ({ ...s, [key]: value }));
    };
    const handleSubmit = async () => {
        setTencentSecret(localTencentSecret);
    };
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="字幕翻译" description="配置腾讯密钥以启用字幕翻译" />
            <ItemWrapper>
                <SettingInput
                    setValue={update('secretId')}
                    title="secretId"
                    inputWidth="w-64"
                    value={localTencentSecret.secretId || ''}
                />
                <SettingInput
                    type="password"
                    inputWidth="w-64"
                    placeHolder="******************"
                    setValue={update('secretKey')}
                    title="secretKey"
                    value={localTencentSecret.secretKey || ''}
                />
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    disabled={eqServer}
                    handleSubmit={handleSubmit}
                />
            </FooterWrapper>
        </form>
    );
};
export default TenantSetting;
