import { ChangeEvent, useEffect, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import SettingButton from '../../../components/setting/SettingButton';
import SettingInput from '../../../components/setting/SettingInput';
import ItemWrapper from '../../../components/setting/ItemWapper';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import Header from '../../../components/setting/Header';

const TenantSetting = () => {
    const [secretId, setSecretId] = useState<string | undefined>();
    const [secretKey, setSecretKey] = useState<string | undefined>();
    const [serverValue, serServerValue] = useState<string[] | undefined>();

    const eqServer =
        serverValue?.[0] === secretId && serverValue?.[1] === secretKey;

    const updateFromServer = async () => {
        const newVar = (await callApi('get-tenant-secret', [])) as string[];
        if (newVar.length === 0) {
            return;
        }
        setSecretId(newVar[0]);
        setSecretKey(newVar[1]);
        serServerValue(newVar);
    };

    useEffect(() => {
        updateFromServer();
    }, []);

    const handleSecretIdChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSecretId(event.target.value);
    };

    const handleSecretKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSecretKey(event.target.value);
    };

    const handleSubmit = async () => {
        await callApi('update-tenant-secret', [secretId, secretKey]);
        await updateFromServer();
        console.log(`A name was submitted: ${secretId}, ${secretKey}`);
    };
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="句子翻译" description="配置腾讯密钥以启用句子翻译"/>
            <ItemWrapper>
                <SettingInput
                    setValue={setSecretId}
                    title="secretId"
                    inputWidth="w-64"
                    value={secretId || ''}
                />
                <SettingInput
                    type="password"
                    inputWidth="w-64"
                    placeHolder="******************"
                    setValue={setSecretKey}
                    title="secretKey"
                    value={secretKey || ''}
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
