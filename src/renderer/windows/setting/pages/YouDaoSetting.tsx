import SettingInput from "../../../components/setting/SettingInput";
import SettingButton from "../../../components/setting/SettingButton";
import FooterWrapper from "../../../components/setting/FooterWrapper";
import ItemWrapper from "../../../components/setting/ItemWapper";
import Header from "../../../components/setting/Header";
import useSettingForm from "../../../hooks/useSettingForm";

const YouDaoSetting = () => {
    const {setting, setSettingFunc, submit, eqServer} = useSettingForm([
        'apiKeys.youdao.secretId',
        'apiKeys.youdao.secretKey',
    ]);
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="查单词" description="配置有道密钥以启用查词功能" />
            <ItemWrapper>
                <SettingInput
                    inputWidth="w-64"
                    setValue={setSettingFunc('apiKeys.youdao.secretId')}
                    title="secretId"
                    value={setting('apiKeys.youdao.secretId')}
                />
                <SettingInput
                    inputWidth="w-64"
                    setValue={setSettingFunc('apiKeys.youdao.secretKey')}
                    title="secretKey"
                    value={setting('apiKeys.youdao.secretKey')}
                    type="password"
                />
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    handleSubmit={submit}
                    disabled={eqServer}
                />
            </FooterWrapper>
        </form>
    );
};
export default YouDaoSetting;
