import { ChangeEvent, useEffect, useState } from 'react';
import callApi from '../../../lib/apis/ApiWrapper';
import SettingInput from '../../../components/setting/SettingInput';
import SettingButton from '../../../components/setting/SettingButton';
import FooterWrapper from '../../../components/setting/FooterWrapper';
import ItemWrapper from '../../../components/setting/ItemWapper';
import Header from '../../../components/setting/Header';

const TenantSetting = () => {
    const [secretId, setSecretId] = useState<string | undefined>();
    const [secretKey, setSecretKey] = useState<string | undefined>();
    const [serverValue, serServerValue] = useState<string[] | undefined>();

    const eqServer =
        serverValue?.[0] === secretId && serverValue?.[1] === secretKey;
    const updateFromServer = async () => {
        const newVar = (await callApi('get-you-dao-secret', [])) as string[];
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
        await callApi('update-you-dao-secret', [secretId, secretKey]);
        await updateFromServer();
        console.log(`A name was submitted: ${secretId}, ${secretKey}`);
    };
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="查单词" description="配置有道密钥以启用查词功能" />
            <ItemWrapper>
                <SettingInput
                    inputWidth="w-64"
                    setValue={setSecretId}
                    title="secretId"
                    value={secretId ?? ''}
                />
                <SettingInput
                    inputWidth="w-64"
                    setValue={setSecretKey}
                    title="secretKey"
                    value={secretKey ?? ''}
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
