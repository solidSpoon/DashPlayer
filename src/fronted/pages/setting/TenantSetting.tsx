import SettingInput from '@/fronted/pages/setting/setting/SettingInput';
import ItemWrapper from '@/fronted/pages/setting/setting/ItemWrapper';
import FooterWrapper from '@/fronted/pages/setting/setting/FooterWrapper';
import Header from '@/fronted/pages/setting/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import {cn} from "@/fronted/lib/utils";
import {Button} from "@/fronted/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/fronted/components/ui/select';
import useTranslation from '@/fronted/hooks/useTranslation';
import { useEffect } from 'react';

const api = window.electron;
const TenantSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'apiKeys.tencent.secretId',
        'apiKeys.tencent.secretKey',
        'translation.engine',
    ]);

    const { setEngine } = useTranslation();

    // 同步翻译引擎设置到 hook
    useEffect(() => {
        const engine = setting('translation.engine') as 'tencent' | 'openai';
        if (engine) {
            setEngine(engine);
        }
    }, [setting('translation.engine'), setEngine]);

    const handleEngineChange = (value: string) => {
        setSettingFunc('translation.engine')(value);
        setEngine(value as 'tencent' | 'openai');
    };

    const currentEngine = setting('translation.engine') || 'tencent';

    return (
        <form className="w-full h-full flex flex-col gap-4">
            <Header title="字幕翻译" description="配置翻译引擎和相关密钥" />

            <ItemWrapper>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">翻译引擎</label>
                        <Select value={currentEngine} onValueChange={handleEngineChange}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="选择翻译引擎" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="tencent">腾讯翻译</SelectItem>
                                <SelectItem value="openai">OpenAI翻译</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-xs text-gray-500">
                            选择翻译引擎。腾讯翻译速度快，OpenAI翻译质量更高。
                        </div>
                    </div>

                    {currentEngine === 'tencent' && (
                        <>
                            <SettingInput
                                setValue={setSettingFunc('apiKeys.tencent.secretId')}
                                title="腾讯云 SecretId"
                                inputWidth="w-64"
                                value={setting('apiKeys.tencent.secretId')}
                            />
                            <SettingInput
                                type="password"
                                inputWidth="w-64"
                                placeHolder="******************"
                                setValue={setSettingFunc('apiKeys.tencent.secretKey')}
                                title="腾讯云 SecretKey"
                                value={setting('apiKeys.tencent.secretKey')}
                            />
                            <div className={cn('text-sm text-gray-500 mt-2 flex flex-row gap-2')}>
                                你需要腾讯云的密钥才能使用字幕翻译，详见
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
                        </>
                    )}

                    {currentEngine === 'openai' && (
                        <div className={cn('text-sm text-gray-500 p-4 bg-blue-50 rounded-lg')}>
                            OpenAI翻译使用您在"OpenAI"页面中配置的密钥和端点。
                            <br />
                            请确保已在OpenAI设置页面中正确配置API密钥。
                        </div>
                    )}
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
export default TenantSetting;
