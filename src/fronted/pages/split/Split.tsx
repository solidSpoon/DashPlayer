import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import { Textarea } from '@/fronted/components/ui/textarea';
import { Label } from '@/fronted/components/ui/label';
import { FileQuestion, FileType2, FileVideo2, Stethoscope } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/fronted/components/ui/tabs';
import SplitFile from '@/fronted/pages/split/SplitFile';
import SplitPreview from "@/fronted/pages/split/split-preview";
import useSplit from "@/fronted/hooks/useSplit";
import {useShallow} from "zustand/react/shallow";
const example = `
00:00:00 Intro
00:00:10 Part 1
00:10:00 Part 2
00:20:00 Part 3
`
const Split = () => {
    const {userInput, setUseInput} = useSplit(useShallow(s=>({
        userInput: s.userInput,
        setUseInput: s.setUseInput
    })));
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
                <Separator orientation="horizontal" className="px-0" />
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
                        value={userInput}
                        onChange={e => setUseInput(e.target.value)}
                        className={cn('flex-1 resize-none')}
                    />
                </div>
                <div className={cn('row-start-2 row-end-3 col-start-1 col-end-2 flex flex-col space-y-2 pt-8')}>
                    <Label>Files</Label>
                    <div className={'p-2 flex flex-col gap-2'}>
                        <div className={'flex gap-4'}>
                            <FileVideo2 /> 未选择
                        </div>
                        <div className={'flex gap-4'}>
                            <FileType2 /> 未选择
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
                                    className={'ml-auto'}><FileQuestion /></Button>
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
                                    variant={'outline'}
                                    size={'icon'}
                                    className={''}><Stethoscope />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                尝试使用 AI 格式化输入
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className={cn('row-start-3 row-end-4 col-start-2 col-end-3 flex')}>
                    <Button className={'ml-auto'}>Transcript All</Button>
                </div>
                <Tabs defaultValue="account"
                      className={cn(
                          'row-start-1 row-end-3 col-start-2 col-end-3 ',
                          'w-full h-full flex flex-col items-center'
                      )}>
                    <TabsList className={'grid w-full grid-cols-2'}>
                        <TabsTrigger value="account">预览</TabsTrigger>
                        <TabsTrigger value="password">选择文件</TabsTrigger>
                    </TabsList>
                    <TabsContent className={'w-full h-full overflow-auto scrollbar-thin'} value="account">
                        <SplitPreview className={'w-full h-full'}/>
                    </TabsContent>
                    <TabsContent value="password" className={'w-full h-full'}>
                        <SplitFile queue={[]} onAddToQueue={()=>{}}/>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};
export default Split;
