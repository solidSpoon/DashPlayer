import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import React from 'react';
import {cn} from '@/fronted/lib/utils';
import {Maximize, Minimize} from "lucide-react";
import {Button} from "@/fronted/components/ui/button";

const FullscreenToggleButton = ({fullScreen, changeFullScreen}: {
    fullScreen: boolean;
    changeFullScreen: (v: boolean) => void;
}) => {
    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        size={'icon'}
                        variant={'ghost'}
                        onClick={() => {
                            changeFullScreen(!fullScreen);
                        }}
                        className='w-8 h-8 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors flex items-center justify-center'
                    >
                        {fullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="end"
                    sideOffset={10}
                    className="max-w-xs p-3 bg-neutral-900/95 backdrop-blur-md border border-white/15 text-white shadow-2xl rounded-xl text-xs space-y-1.5"
                >
                    <div className="font-semibold text-sm text-neutral-100">点击隐藏 / 显示字幕列表</div>
                    <div className="text-neutral-400 text-[11px] leading-relaxed">
                        全屏播放提示：<br />
                        <span className="text-neutral-300 font-medium">Windows:</span> 右键点击标题栏最大化按钮<br />
                        <span className="text-neutral-300 font-medium">Mac:</span> 点击窗口左上角绿色全屏按钮
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};


export default FullscreenToggleButton;
