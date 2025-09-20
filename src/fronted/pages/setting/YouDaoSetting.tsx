import SettingInput from '@/fronted/pages/setting/setting/SettingInput';
import FooterWrapper from '@/fronted/pages/setting/setting/FooterWrapper';
import ItemWrapper from '@/fronted/pages/setting/setting/ItemWrapper';
import Header from '@/fronted/pages/setting/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";
import {as} from "tencentcloud-sdk-nodejs";

const api = window.electron;
const YouDaoSetting = () => {
    const {setting, setSettingFunc, submit, eqServer} = useSettingForm([
        'apiKeys.youdao.secretId',
        'apiKeys.youdao.secretKey',
    ]);
    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="查单词" description="配置有道密钥以启用查词功能"/>
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
                        onClick={async () => {
                            await api.call('system/open-url',
                                'https://solidspoon.xyz/DashPlayer/'
                            );
                        }}
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
                            'https://solidspoon.xyz/DashPlayer/'
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
export default YouDaoSetting;
