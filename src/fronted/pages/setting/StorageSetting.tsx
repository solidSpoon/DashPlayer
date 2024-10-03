import { useEffect, useState } from 'react';
import Header from '@/fronted/components/setting/Header';
import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import { Button } from '@/fronted/components/ui/button';
import SettingInput from '../../components/setting/SettingInput';
import { cn } from '@/fronted/lib/utils';
import * as React from 'react';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import { FolderOpen } from 'lucide-react';
import useSystem from '@/fronted/hooks/useSystem';
import Combobox from '@/fronted/components/setting/Combobox';
import useSWR from 'swr';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import { Label } from '@/fronted/components/ui/label';
import useFile from '@/fronted/hooks/useFile';
import toast from 'react-hot-toast';
import StrUtil from '@/common/utils/str-util';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import Md from '@/fronted/components/chat/markdown';
import { codeBlock } from 'common-tags';

const api = window.electron;
const StorageSetting = () => {
    const [size, setSize] = useState<string>('0 KB');
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'storage.path',
        'storage.collection'
    ]);
    useEffect(() => {
        const init = async () => {
            const s = await api.call('storage/cache/size');
            setSize(s);
        };
        init();
    }, []);


    async function reloadOss() {
        await api.call('favorite-clips/sync-from-oss');
        await swrApiMutate('favorite-clips/search');
        useFile.setState({
            subtitlePath: null
        });
    }

    const handleSubmit = async () => {
        submit();
    };

    const handleClear = async () => {
        await api.call('system/reset-db');
    };

    const handleOpen = async () => {
        await api.call('system/open-folder/cache');
    };

    const { data: collectionPaths } = useSWR(apiPath('storage/collection/paths'), (url) => api.call(url));

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <Header
                title="存储"
                description={
                    <span>
                        DashPlayer 会缓存翻译结果，以降低 API 调用成本。
                        <br />
                        缓存文件由数据库软件维护，请不要编辑缓存文件。
                    </span>
                }
            />
            <ItemWrapper>
                <div className="mt-4 flex text-lg flex-row items-center gap-2">
                    <text>占用空间</text>
                    <text>{size}</text>
                </div>

                <div className="flex gap-2 items-end">
                    <SettingInput
                        className={cn('w-fit')}
                        type="text"
                        inputWidth="w-96"
                        placeHolder="Documents/DashPlayer"
                        setValue={setSettingFunc('storage.path')}
                        title="Storage Path"
                        value={setting('storage.path')}
                    />
                    <Button className={'mb-1.5'} variant={'outline'} size={'icon'}
                            onClick={async () => {
                                const folder: string[] = await api.call('system/select-folder', {createDirectory: true});
                                if (folder.length > 0) {
                                    const f = `${folder[0]}`;
                                    setSettingFunc('storage.path')(f);
                                }
                            }}><FolderOpen /></Button>
                </div>
                <div className="flex gap-2 items-end">
                    <div className={cn('grid items-center gap-1.5 pl-2 w-fit')}>
                        <Label>切换收藏夹</Label>
                        <div className={'flex gap-2'}>
                            <Combobox
                                options={collectionPaths?.map((p) => ({ value: p, label: p })) ?? []}
                                value={setting('storage.collection')}
                                onSelect={(value) => {
                                    if (StrUtil.isNotBlank(value)) {
                                        setSettingFunc('storage.collection')(value);
                                    }
                                }} />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            disabled={!eqServer}
                                            onClick={async () => {
                                                await toast.promise(reloadOss(), {
                                                    loading: '正在加载本地收藏夹',
                                                    success: '本地收藏夹加载成功',
                                                    error: '本地收藏夹加载失败'
                                                });
                                            }}
                                            variant={'outline'}>
                                            重新同步收藏夹数据
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="p-8 pb-6 rounded-md shadow-lg bg-white text-gray-800">
                                        <Md>
                                            {codeBlock`
                                            #### 重新同步收藏夹数据
                                            将该文件夹中的数据同步到 DashPlayer 中，遇到问题可以尝试使用此功能。
                                            `}
                                        </Md>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        <p>
                            favourite_clips 文件夹下的子文件夹会被视为收藏夹
                        </p>
                    </div>
                </div>
            </ItemWrapper>
            <FooterWrapper>
                <Button
                    onClick={handleClear}
                    variant="secondary"
                >
                    重置数据库
                </Button>
                <Button
                    onClick={handleOpen}
                    variant="secondary"
                >
                    打开缓存文件夹
                </Button>
                <Button
                    disabled={eqServer}
                    onClick={async () => {
                        await handleSubmit();
                        await toast.promise(reloadOss(), {
                            loading: '正在加载本地收藏夹',
                            success: '本地收藏夹加载成功',
                            error: '本地收藏夹加载失败'
                        });
                    }}
                >
                    Apply
                </Button>
            </FooterWrapper>
        </div>
    );
};
export default StorageSetting;
