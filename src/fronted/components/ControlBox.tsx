import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AiOutlineFieldTime } from 'react-icons/ai';
import toast from 'react-hot-toast';
import { cn } from '@/common/utils/Util';
import usePlayerController from '../hooks/usePlayerController';
import useLayout, { cpH, cpW } from '../hooks/useLayout';
import { sentenceClearAllAdjust } from '../hooks/usePlayerControllerSlices/createSentenceSlice';
import { Switch } from '@/fronted/components/ui/switch';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useSetting from '@/fronted/hooks/useSetting';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { SettingKey } from '@/common/types/store_schema';
import useSystem from '@/fronted/hooks/useSystem';

const getShortcut = (key: SettingKey) => {
    return useSetting.getState().setting(key);
};

const ControlBox = () => {
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpH.bind(
        null,
        useLayout((s) => s.height)
    );
    // const fullScreen = useLayout((s) => s.fullScreen);
    // const changeFullScreen = useLayout((s) => s.changeFullScreen);
    const {
        showEn,
        showCn,
        singleRepeat,
        changeShowEn,
        changeShowCn,
        changeSingleRepeat
    } = usePlayerController(
        useShallow((s) => ({
            showEn: s.showEn,
            showCn: s.showCn,
            showWordLevel: s.showWordLevel,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeShowWordLevel: s.changeShowWordLevel,
            singleRepeat: s.singleRepeat,
            changeSingleRepeat: s.changeSingleRepeat,
            changePopType: s.changePopType
        }))
    );
    const setSetting = useSetting((s) => s.setSetting);
    const setting = useSetting((s) => s.setting);


    const [clearAllAdjust, setClearAllAdjust] = useState(false);
    let {
        setWindowState,
        windowState
    } = useSystem(useShallow(s => ({
        setWindowState: s.setWindowState,
        windowState: s.windowState
    })));


    const controlItem = ({
                             checked, onCheckedChange, id, label, tooltip
                         }: {
        checked: boolean,
        onCheckedChange: () => void,
        id: string,
        label: string,
        tooltip?: string,
    }) => {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='flex items-center space-x-2'>
                            <Switch
                                checked={checked}
                                onCheckedChange={onCheckedChange}
                                id={id}
                            />
                            <Label htmlFor={id}>{label}</Label>
                        </div>
                    </TooltipTrigger>
                    {tooltip &&
                        <TooltipContent>
                            {tooltip}
                        </TooltipContent>}
                </Tooltip>
            </TooltipProvider>
        );
    };


    return (
        <Card
            className={cn('w-full h-full flex flex-col')}
        ><CardHeader>
            <CardTitle>Control Center</CardTitle>
            <CardDescription>Control the subtitle and video</CardDescription>
        </CardHeader>
            <CardContent
                className={cn('grid place-content-start overflow-y-auto gap-y-4 w-full h-0 flex-1 pt-1',
                    'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded'
                )}
                style={{
                    'gridTemplateColumns': 'repeat(auto-fit, minmax(150px, 1fr))' /* 修改最小宽度和列数以适应你的需求 */
                }}
            >
                {controlItem({
                    checked: showEn,
                    onCheckedChange: changeShowEn,
                    id: 'showEn',
                    label: '展示英文字幕',
                    tooltip: `快捷键为 ${getShortcut('shortcut.toggleEnglishDisplay')}`
                })}
                {controlItem({
                    checked: showCn,
                    onCheckedChange: changeShowCn,
                    id: 'showCn',
                    label: '展示中文字幕',
                    tooltip: `快捷键为 ${getShortcut('shortcut.toggleChineseDisplay')}`
                })}
                {controlItem({
                    checked: singleRepeat,
                    onCheckedChange: changeSingleRepeat,
                    id: 'singleRepeat',
                    label: '单句循环',
                    tooltip: `快捷键为 ${getShortcut('shortcut.repeatSentence')}`
                })}
                {controlItem({
                    checked: setting('appearance.theme') === 'dark',
                    onCheckedChange: () => {
                        setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
                    },
                    id: 'nightMode',
                    label: '夜间模式',
                    tooltip: `快捷键为 ${getShortcut('shortcut.nextTheme')}`
                })}
                {controlItem({
                    checked: windowState === 'fullscreen',
                    onCheckedChange: () => {
                        if (windowState === 'fullscreen') {
                            setWindowState('normal');
                        } else {
                            setWindowState('fullscreen');
                        }
                    },
                    id: 'fullScreen',
                    label: '全屏模式',
                    tooltip: '点击进入/退出全屏'
                })}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className='flex items-center space-x-2'>
                                <Switch
                                    checked={clearAllAdjust}
                                    onCheckedChange={(c) => {
                                        if (!c) {
                                            return;
                                        }
                                        setClearAllAdjust(true);
                                        setTimeout(() => {
                                            setClearAllAdjust(false);
                                        }, 1000);
                                        sentenceClearAllAdjust();
                                        toast('清除了', {
                                            icon: '👏'
                                        });
                                    }}
                                    id='clearAllAdjust'
                                />
                                <Label htmlFor='clearAllAdjust'>清除时间调整</Label>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className='p-4 rounded-md shadow-lg bg-white text-gray-800'>
                            <p className='font-semibold'>
                                当字幕时间戳不准确时, 可以使用如下快捷键调整:
                            </p>
                            <p className='mt-2'>
                                快捷键 <span
                                className='font-bold'>{getShortcut('shortcut.adjustBeginMinus')}</span> 将当前句子开始时间提前
                                0.2 秒<br />
                                快捷键 <span
                                className='font-bold'>{getShortcut('shortcut.adjustBeginPlus')}</span> 将当前句子开始时间推后
                                0.2 秒<br />
                                快捷键 <span
                                className='font-bold'>{getShortcut('shortcut.adjustEndMinus')}</span> 将当前句子结束时间提前
                                0.2 秒<br />
                                快捷键 <span
                                className='font-bold'>{getShortcut('shortcut.adjustEndPlus')}</span> 将当前句子结束时间推后
                                0.2 秒<br />
                            </p>
                            <p className='mt-2'>
                                这个按钮用于清除当前视频的所有时间调整
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
};

export default ControlBox;
