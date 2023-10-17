import { ChangeEvent, useEffect, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import SettingInput from '../../../components/setting/SettingInput';
import SettingButton from '../../../components/setting/SettingButton';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import ItemWrapper from '../../../components/setting/ItemWapper';
import Header from '../../../components/setting/Header';
import useSetting, { Secret } from '../../../hooks/useSetting';

const TenantSetting = () => {
    const youdaoSecret = useSetting((s) => s.youdaoSecret);
    const setYoudaoSecret = useSetting((s) => s.setYoudaoSecret);
    const [localYoudaoSecret, setLocalYoudaoSecret] =
        useState<Secret>(youdaoSecret);

    const eqServer =
        JSON.stringify(youdaoSecret) === JSON.stringify(localYoudaoSecret);
    const update = (key: keyof Secret) => (value: string) => {
        setLocalYoudaoSecret((s) => ({ ...s, [key]: value }));
    };

    const handleSubmit = async () => {
        setYoudaoSecret(localYoudaoSecret);
    };
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="查单词" description="配置有道密钥以启用查词功能" />
            <ItemWrapper>
                <SettingInput
                    inputWidth="w-64"
                    setValue={update('secretId')}
                    title="secretId"
                    value={localYoudaoSecret.secretId ?? ''}
                />
                <SettingInput
                    inputWidth="w-64"
                    setValue={update('secretKey')}
                    title="secretKey"
                    value={localYoudaoSecret.secretKey ?? ''}
                    type="password"
                />
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    handleSubmit={handleSubmit}
                    disabled={eqServer}
                />
            </FooterWrapper>
        </form>
    );
};
export default TenantSetting;
