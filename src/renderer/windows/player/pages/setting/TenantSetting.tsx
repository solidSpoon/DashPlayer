import SettingButton from '../../../../components/setting/SettingButton';
import SettingInput from '../../../../components/setting/SettingInput';
import ItemWrapper from '../../../../components/setting/ItemWrapper';
import FooterWrapper from '../../../../components/setting/FooterWrapper';
import Header from '../../../../components/setting/Header';
import useSettingForm from "../../../../hooks/useSettingForm";


const TenantSetting = () => {
    const {setting, setSettingFunc, submit, eqServer} = useSettingForm([
        'apiKeys.tencent.secretId',
        'apiKeys.tencent.secretKey',
    ]);

    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="字幕翻译" description="配置腾讯密钥以启用字幕翻译" />
            <ItemWrapper>
                <SettingInput
                    setValue={setSettingFunc('apiKeys.tencent.secretId')}
                    title="secretId"
                    inputWidth="w-64"
                    value={setting('apiKeys.tencent.secretId')}
                />
                <SettingInput
                    type="password"
                    inputWidth="w-64"
                    placeHolder="******************"
                    setValue={setSettingFunc('apiKeys.tencent.secretKey')}
                    title="secretKey"
                    value={setting('apiKeys.tencent.secretKey')}
                />
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    disabled={eqServer}
                    handleSubmit={submit}
                />
            </FooterWrapper>
        </form>
    );
};
export default TenantSetting;
