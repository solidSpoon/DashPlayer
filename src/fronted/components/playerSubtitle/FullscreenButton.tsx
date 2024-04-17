import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {Toggle} from '@/fronted/components/ui/toggle';
import React from 'react';
import {cn} from '@/fronted/lib/utils';
import {Maximize, Minimize} from "lucide-react";
import {Button} from "@/fronted/components/ui/button";

const FullscreenButton = ({fullScreen, changeFullScreen}: {
    fullScreen: boolean;
    changeFullScreen: (v: boolean) => void;
}) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        size={'icon'}
                        variant={'ghost'}
                        // size={'md'}
                        // onClick={fullScreen}
                        onClick={(v) => {
                            changeFullScreen(!fullScreen);
                        }}
                        className='flex items-center justify-center'
                    >
                        {fullScreen ? <Minimize/> : <Maximize/>}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p className='text-sm'>
                        <h1 className={cn('text-lg font-bold')}>点击隐藏/展示右侧和下侧的字幕</h1>
                        如果想要全屏:<br/>
                        <p className='mt-2'>
                            <b className='font-semibold'> Windows:</b> <b>右键</b>点击标题栏最大化按钮<br/>
                            <b className='font-semibold'> Mac:</b> 点击红绿灯全屏按钮
                        </p>
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};


export default FullscreenButton;
