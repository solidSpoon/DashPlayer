import SettingInput from '@/fronted/components/setting/SettingInput';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";

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
                <Button
                    onClick={async () => {
                        await api.call('system/open-url',
                            'https://solidspoon.xyz/docs/dash-player/intro'
                        );
                    }}
                    variant="secondary"
                >
                    查看文档
                </Button>
                <Button
                    disabled={eqServer}
                    onClick={submit}
                >
                    Apply
                </Button>
            </FooterWrapper>
        </form>
    );
};
export default TenantSetting;
