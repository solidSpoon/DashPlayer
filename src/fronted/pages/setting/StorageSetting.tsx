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


    const handleSubmit = async () => {
        submit();
        await api.call('favorite-clips/sync-from-oss');
        await swrApiMutate('favorite-clips/search');
        useFile.setState({
            subtitlePath: null
        });
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
                                const folder: string[] = await api.call('system/select-folder', {});
                                if (folder.length > 0) {
                                    const f = `${folder[0]}${useSystem.getState().pathSeparator}DashPlayer`;
                                    setSettingFunc('storage.path')(f);
                                }
                            }}><FolderOpen /></Button>
                </div>
                <div className="flex gap-2 items-end">
                    <div className={cn('grid items-center gap-1.5 pl-2 w-fit')}>
                        <Label>切换收藏夹</Label>
                        <Combobox
                            options={collectionPaths?.map((p) => ({ value: p, label: p })) ?? []}
                            value={setting('storage.collection')}
                            onSelect={setSettingFunc('storage.collection')} />
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
                    onClick={handleSubmit}
                >
                    Apply
                </Button>
            </FooterWrapper>
        </div>
    );
};
export default StorageSetting;
