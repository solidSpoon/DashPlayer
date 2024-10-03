import SettingInput from '@/fronted/components/setting/SettingInput';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import { cn } from '@/fronted/lib/utils';
import { Button } from '@/fronted/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import { EllipsisVertical, Eraser, SquarePlus } from 'lucide-react';
import * as React from 'react';
import { Switch } from '@/fronted/components/ui/switch';
import { Label } from '@/fronted/components/ui/label';

const api = window.electron;
const OpenAiSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'apiKeys.openAi.key',
        'apiKeys.openAi.endpoint',
        'apiKeys.openAi.stream',
        'model.gpt.default'
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
                    type="password"
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
                <div className={'flex justify-start items-end gap-2'}>
                    <SettingInput
                        className={cn('w-fit')}
                        type="text"
                        inputWidth="w-64"
                        placeHolder="gpt-4o"
                        setValue={setSettingFunc('model.gpt.default')}
                        title="model"
                        value={setting('model.gpt.default')}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className={'mb-1.5'} variant={'outline'} size={'icon'}>
                                <EllipsisVertical />
                            </Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSettingFunc('model.gpt.default')('gpt-4o-mini');
                                }}
                            >gpt-4o-mini (Recommend)</DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSettingFunc('model.gpt.default')('gpt-4o');
                                }}
                            >gpt-4o</DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    setSettingFunc('model.gpt.default')('gpt-3.5-turbo');
                                }}
                            >gpt-3.5-turbo</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-col gap-2 pl-2">
                    <Label>Streaming Response</Label>
                    <div className="flex items-center space-x-2">
                        <Switch id="stream"
                                checked={setting('apiKeys.openAi.stream') === 'on'}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        setSettingFunc('apiKeys.openAi.stream')('on');
                                    } else {
                                        setSettingFunc('apiKeys.openAi.stream')('off');
                                    }
                                }}
                        />
                        <Label
                            className="font-light">观察到有些代理商在启用流式响应时会出现问题，如果你遇到问题，请尝试关闭此选项</Label>
                    </div>
                </div>

                <div
                    className={cn(
                        'text-sm text-gray-500 mt-2 flex flex-row gap-2'
                    )}
                >
                    你需要配置 OpenAI 密钥以启用转录、AI 生成等功能，详见
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
export default OpenAiSetting;
