import SettingButton from '../../../../components/setting/SettingButton';
import SettingInput from '../../../../components/setting/SettingInput';
import ItemWrapper from '../../../../components/setting/ItemWrapper';
import FooterWrapper from '../../../../components/setting/FooterWrapper';
import Header from '../../../../components/setting/Header';
import useSettingForm from '../../../../hooks/useSettingForm';
import { cn } from '../../../../../common/utils/Util';

const api = window.electron;
const TenantSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
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
                <div
                    className={cn(
                        'text-sm text-gray-500 mt-2 flex flex-row gap-2'
                    )}
                >
                    你需要腾讯云的密钥才能使用字幕翻译，详见
                    <a
                        className={cn('underline')}
                        href="https://solidspoon.xyz/docs/dash-player/intro"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        文档
                    </a>
                </div>
            </ItemWrapper>
            <FooterWrapper>
                <SettingButton
                    kind="secondary"
                    handleSubmit={() => {
                        api.openUrl(
                            'https://solidspoon.xyz/docs/dash-player/intro'
                        );
                    }}
                >
                    查看文档
                </SettingButton>
                <SettingButton disabled={eqServer} handleSubmit={submit} />
            </FooterWrapper>
        </form>
    );
};
export default TenantSetting;
