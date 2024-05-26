import {cn} from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React, {useEffect} from 'react';
import {Button} from '@/fronted/components/ui/button';
import {Textarea} from '@/fronted/components/ui/textarea';
import {Label} from '@/fronted/components/ui/label';
import {FileQuestion, FileType2, FileVideo2, Stethoscope, X, File} from 'lucide-react';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/fronted/components/ui/tabs';
import SplitFile from '@/fronted/pages/split/SplitFile';
import SplitPreview from '@/fronted/pages/split/split-preview';
import useSplit from '@/fronted/hooks/useSplit';
import {useShallow} from 'zustand/react/shallow';
import useSWR from 'swr';
import toast from "react-hot-toast";
import { AllFormats } from '@/common/utils/MediaUtil';

const api = window.electron;

const example = `
00:00:00 Intro
00:01:10 Part 1
00:10:00 Part 2
00:20:00 Part 3
`;

const Split = () => {
    const {
        userInput,
        setUseInput,
        videoPath,
        srtPath,
        deleteFile,
        updateFile,
        inputable,
        aiFormat,
        runSplitAll
    } = useSplit(useShallow(s => ({
        userInput: s.userInput,
        setUseInput: s.setUseInput,
        videoPath: s.videoPath,
        srtPath: s.srtPath,
        deleteFile: s.deleteFile,
        updateFile: s.updateFile,
        aiFormat: s.aiFormat,
        inputable: s.inputable,
        runSplitAll: s.runSplitAll
    })));
    const {data: video} = useSWR(videoPath ? ['system/select-file', videoPath] : null, ([_key, path]) => api.call('system/path-info', path));
    const {data: srt} = useSWR(srtPath ? ['system/select-file', srtPath] : null, ([_key, path]) => api.call('system/path-info', path));
    const onSelect = async () => {
        const files = await api.call('system/select-file', AllFormats);
        files.forEach(updateFile);
    };

    useEffect(() => {
        useSplit.setState({inputable: true})
    }, [])
    const [spliting, setSpliting] = React.useState(false);
    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background p-6 pt-12 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Split Long Video
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Split long video & subtitle files into smaller parts
                </h2>
                <Separator orientation="horizontal" className="px-0"/>
            </div>
            <div className={cn('grid grid-rows-3 grid-cols-2 gap-2 gap-x-20 w-full h-0 flex-1 px-10 pr-16')}
                 style={{
                     gridTemplateRows: '1fr auto auto',
                     gridTemplateColumns: '1fr 55%'
                 }}
            >
                <div className={cn('row-start-1 row-end-2 col-start-1 col-end-2 flex flex-col space-y-2 pt-4')}>
                    <Label>Input</Label>
                    <Textarea
                        disabled={!inputable}
                        value={userInput}
                        onChange={e => setUseInput(e.target.value)}
                        className={cn('flex-1 resize-none')}
                    />
                </div>
                <div className={cn('row-start-2 row-end-3 col-start-1 col-end-2 flex flex-col space-y-2 pt-8')}>
                    <Label>Files</Label>
                    <div className={'p-2 flex flex-col gap-2 w-full'}>
                        <div className={'flex gap-4'}>
                            <FileVideo2/> {video?.baseName ?
                            <>
                                <div className={'line-clamp-2 break-words w-0 flex-1'}> {video?.baseName}</div>
                                <Button
                                    variant={'ghost'}
                                    size={'icon'}
                                    className={'w-6 h-6 -auto'}
                                    onClick={() => deleteFile(videoPath)}
                                ><X/></Button>
                            </> : <span className={'hover:underline'}
                                        onClick={onSelect}
                            >点击以选择</span>}
                        </div>
                        <div className={'flex gap-4'}>
                            <FileType2/> {srt?.baseName ?
                            <>
                                <div className={'line-clamp-2 break-words h-fit w-0 flex-1'}>{srt?.baseName}</div>
                                <Button
                                    variant={'ghost'}
                                    size={'icon'}
                                    className={'w-6 h-6 ml-auto'}
                                    onClick={() => deleteFile(srtPath)}
                                ><X/></Button>
                            </> : <span className={'hover:underline'}
                                        onClick={onSelect}
                            >点击以选择</span>}
                        </div>

                    </div>
                </div>
                <div className={cn('row-start-3 row-end-4 col-start-1 col-end-2 flex gap-2')}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={'outline'}
                                    size={'icon'}
                                    onClick={() => setUseInput(example.trim())}
                                    className={'ml-auto'}><FileQuestion/></Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                加载示例配置
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => {
                                        aiFormat();
                                    }}
                                    variant={'outline'}
                                    size={'icon'}
                                    className={''}><Stethoscope/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                尝试使用 AI 格式化输入
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Tabs defaultValue="account"
                      className={cn(
                          'row-start-1 row-end-3 col-start-2 col-end-3',
                          'w-full h-full flex flex-col items-center'
                      )}>
                    <TabsList className={'grid w-full grid-cols-2'}>
                        <TabsTrigger value="account">预览</TabsTrigger>
                        <TabsTrigger value="password">快捷选择</TabsTrigger>
                    </TabsList>
                    <TabsContent className={'w-full h-full overflow-auto scrollbar-thin'} value="account">
                        <SplitPreview className={'w-full h-full'}/>
                    </TabsContent>
                    <TabsContent value="password" className={'w-full overflow-y-auto'}>
                        <SplitFile/>
                    </TabsContent>
                </Tabs>
                <div className={cn('row-start-3 row-end-4 col-start-2 col-end-3 flex z-10')}>
                    <Button
                        variant={'secondary'}
                        onClick={onSelect}
                        className={'ml-auto mr-2'}>Select File</Button>
                    <Button
                        disabled={spliting}
                        onClick={async () => {
                            setSpliting(true);
                            try {
                                await toast.promise(runSplitAll(), {
                                    loading: 'Splitting...',
                                    success: 'Split Finished',
                                    error: (v)=>{
                                        return v?.message??'Split Failed'
                                    }
                                });
                            } finally {
                                setSpliting(false);
                            }
                        }}
                        className={''}>Split All</Button>
                </div>
            </div>
        </div>
    );
};
export default Split;
