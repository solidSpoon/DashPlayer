import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import toast from 'react-hot-toast';
import { cn } from '@/fronted/lib/utils';
import usePlayerController from '../hooks/usePlayerController';
import useLayout from '../hooks/useLayout';
import { sentenceClearAllAdjust } from '../hooks/usePlayerControllerSlices/createSentenceSlice';
import { Switch } from '@/fronted/components/ui/switch';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/fronted/components/ui/card';
import useSetting from '@/fronted/hooks/useSetting';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { SettingKey } from '@/common/types/store_schema';
import useSWR from 'swr';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { Button } from '@/fronted/components/ui/button';
import { Captions, Eraser } from 'lucide-react';
import Md from '@/fronted/components/chat/markdown';
import { codeBlock } from 'common-tags';
import useTranscript from '@/fronted/hooks/useTranscript';
import useFile from '@/fronted/hooks/useFile';
import StrUtil from '@/common/utils/str-util';
import { useLocalStorage } from '@uidotdev/usehooks';
import TimeUtil from '@/common/utils/TimeUtil';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';

const api = window.electron;

const getShortcut = (key: SettingKey) => {
    return useSetting.getState().setting(key);
};

const Transcript = () => {
    const [taskId, setTaskId] = useLocalStorage<null | number>('control-box-transcript-task-id', null);
    const { task } = useDpTaskViewer(taskId);

    const duration = new Date().getTime() - TimeUtil.isoToDate(task?.created_at).getTime();
    const inProgress = (task?.status ?? DpTaskState.DONE) === DpTaskState.IN_PROGRESS;
    console.log('taskTranscript', task, duration, inProgress);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        disabled={inProgress}
                        className={'justify-start'}
                        onClick={async () => {
                            const srtPath = useFile.getState().videoPath;
                            if (StrUtil.isBlank(srtPath)) {
                                toast.error('请先选择一个视频文件');
                                return;
                            }
                            toast('已添加到转录队列', {
                                icon: '👏'
                            });
                            const taskId = await useTranscript.getState().onTranscript(srtPath);
                            setTaskId(taskId);
                        }}
                        variant={'ghost'}
                    >
                        <Captions className="mr-2 h-4 w-4" />
                        {inProgress ? task?.progress ?? '转录中' : '生成字幕'
                        }
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="p-8 pb-6 rounded-md shadow-lg bg-white text-gray-800">
                    <Md>
                        {codeBlock`
                                #### 生成字幕
                                使用人工智能为当前视频生成字幕，保存在视频文件夹中，完成时自动加载。
                                `}
                    </Md>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const ControlBox = () => {
    const {
        showEn,
        showCn,
        syncSide,
        singleRepeat,
        changeShowEn,
        changeShowCn,
        changeSyncSide,
        changeSingleRepeat,
        autoPause,
        changeAutoPause
    } = usePlayerController(
        useShallow((s) => ({
            showEn: s.showEn,
            showCn: s.showCn,
            syncSide: s.syncSide,
            showWordLevel: s.showWordLevel,
            changeShowEn: s.changeShowEn,
            changeShowCn: s.changeShowCn,
            changeSyncSide: s.changeSyncSide,
            changeShowWordLevel: s.changeShowWordLevel,
            singleRepeat: s.singleRepeat,
            changeSingleRepeat: s.changeSingleRepeat,
            autoPause: s.autoPause,
            changeAutoPause: s.changeAutoPause
        }))
    );
    const setSetting = useSetting((s) => s.setSetting);
    const setting = useSetting((s) => s.setting);
    const { data: windowState } = useSWR(SWR_KEY.WINDOW_SIZE, () => api.call('system/window-size'));
    const { podcstMode, setPodcastMode } = useLayout(useShallow(s => ({
        podcstMode: s.podcastMode,
        setPodcastMode: s.setPodcastMode
    })));
    const changeFullScreen = useLayout(s => s.changeFullScreen);

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
                        <div className="flex items-center space-x-2">
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
            <CardTitle>Player Controls</CardTitle>
            <CardDescription>Manage player settings and behavior</CardDescription>
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
                    checked: syncSide,
                    onCheckedChange: changeSyncSide,
                    id: 'syncSide',
                    label: '同步侧边字幕',
                    tooltip: '隐藏英文字幕时也隐藏侧边字幕，鼠标移动到侧边时显示'
                })}
                {controlItem({
                    checked: singleRepeat,
                    onCheckedChange: changeSingleRepeat,
                    id: 'singleRepeat',
                    label: '单句循环',
                    tooltip: `快捷键为 ${getShortcut('shortcut.repeatSentence')}`
                })}
                {controlItem({
                    checked: autoPause,
                    onCheckedChange: changeAutoPause,
                    id: 'autoPause',
                    label: '自动暂停',
                    tooltip: `当前句子结束自动暂停 快捷键为 ${getShortcut('shortcut.autoPause')}`
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
                    onCheckedChange: async () => {
                        if (windowState === 'fullscreen') {
                            await api.call('system/window-size/change', 'normal');
                        } else {
                            await api.call('system/window-size/change', 'fullscreen');
                        }
                        await swrMutate(SWR_KEY.WINDOW_SIZE);
                    },
                    id: 'fullScreen',
                    label: '全屏模式',
                    tooltip: '点击进入/退出全屏'
                })}
                {controlItem({
                    checked: podcstMode,
                    onCheckedChange: () => {
                        setPodcastMode(!podcstMode);
                        changeFullScreen(false);
                    },
                    id: 'podcstMode',
                    label: '播客模式',
                    tooltip: '播放音频文件时请启用播客模式'
                })}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                className={'justify-start'}
                                onClick={async () => {
                                    toast('清除了', {
                                        icon: '👏'
                                    });
                                    await sentenceClearAllAdjust();
                                }}
                                variant={'ghost'}
                            >
                                <Eraser className="mr-2 h-4 w-4" />清除时间调整
                            </Button>

                        </TooltipTrigger>
                        <TooltipContent className="p-8 pb-6 rounded-md shadow-lg text-gray-800">
                            <Md>
                                {codeBlock`
                                #### 清除时间调整
                                _清除当前视频的所有时间调整_

                                当字幕时间戳不准确时, 可以使用如下快捷键调整:
                                - 快捷键 ${getShortcut('shortcut.adjustBeginMinus')} 将当前句子开始时间提前 0.2 秒
                                - 快捷键 ${getShortcut('shortcut.adjustBeginPlus')} 将当前句子开始时间推后 0.2 秒
                                - 快捷键 ${getShortcut('shortcut.adjustEndMinus')} 将当前句子结束时间提前 0.2 秒
                                - 快捷键 ${getShortcut('shortcut.adjustEndPlus')} 将当前句子结束时间推后 0.2 秒
                                `}
                            </Md>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <Transcript />
            </CardContent>
        </Card>
    );
};

export default ControlBox;
