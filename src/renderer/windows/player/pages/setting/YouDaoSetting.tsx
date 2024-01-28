import SettingInput from '../../../../components/setting/SettingInput';
import SettingButton from '../../../../components/setting/SettingButton';
import FooterWrapper from '../../../../components/setting/FooterWrapper';
import ItemWrapper from '../../../../components/setting/ItemWrapper';
import Header from '../../../../components/setting/Header';
import useSettingForm from '../../../../hooks/useSettingForm';
import { cn } from '../../../../../common/utils/Util';

const api = window.electron;
const YouDaoSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
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
                <div
                    className={cn(
                        'text-sm text-gray-500 mt-2 flex flex-row gap-2'
                    )}
                >
                    你需要有道智云的密钥才能使用查单词功能，详见
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
                <SettingButton handleSubmit={submit} disabled={eqServer} />
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
            </FooterWrapper>
        </form>
    );
};
export default YouDaoSetting;
