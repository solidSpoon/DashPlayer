import SettingInput from '@/fronted/components/setting/SettingInput';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";

const api = window.electron;
const OpenAiSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'apiKeys.openAi.key',
        'apiKeys.openAi.endpoint',
    ]);

    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="OpenAI" description="配置 OpenAI 密钥以启用转录、AI 生成等功能" />
            <ItemWrapper>
                <SettingInput
                    setValue={setSettingFunc('apiKeys.openAi.key')}
                    title="key"
                    placeHolder="sk-******************"
                    inputWidth="w-64"
                    type='password'
                    value={setting('apiKeys.openAi.key')}
                />
                <SettingInput
                    type="endpoint"
                    inputWidth="w-64"
                    placeHolder="https://api.openai.com"
                    setValue={setSettingFunc('apiKeys.openAi.endpoint')}
                    title="endpoint"
                    value={setting('apiKeys.openAi.endpoint')}
                />
                <div
                    className={cn(
                        'text-sm text-gray-500 mt-2 flex flex-row gap-2'
                    )}
                >
                    你需要配置 OpenAI 密钥以启用转录、AI 生成等功能，详见
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
                    onClick={() => {
                        api.openUrl(
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
export default OpenAiSetting;
