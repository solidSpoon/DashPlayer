import React, {useState} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {AiOutlineFieldTime} from 'react-icons/ai';
import toast from 'react-hot-toast';
import {cn} from '@/common/utils/Util';
import usePlayerController from '../hooks/usePlayerController';
import useLayout, {cpH, cpW} from '../hooks/useLayout';
import Button from './Button';
import {sentenceClearAllAdjust} from '../hooks/usePlayerControllerSlices/createSentenceSlice';
import {Switch} from "@/fronted/components/ui/switch";
import {Label} from './ui/label';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/fronted/components/ui/card";
import useSetting from "@/fronted/hooks/useSetting";

const ControlBox = () => {
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpH.bind(
        null,
        useLayout((s) => s.height)
    );
    const fullScreen = useLayout((s) => s.fullScreen);
    const changeFullScreen = useLayout((s) => s.changeFullScreen);
    const {
        showEn,
        showCn,
        showWordLevel,
        singleRepeat,
        changeShowEn,
        changeShowCn,
        changeShowWordLevel,
        changeSingleRepeat,
        changePopType,
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
            changePopType: s.changePopType,
        }))
    );
    const setSetting = useSetting((s) => s.setSetting);
    const setting = useSetting((s) => s.setting);


    const [clearAllAdjust, setClearAllAdjust] = useState(false)
    return (
        <Card
            // className={twMerge(
            //     'flex justify-center items-center gap-4 p-8 rounded-lg w-full h-full text-black flex-col',
            //     'drop-shadow-lg  bg-white/90',
            //     h('md') && 'gap-1 p-2',
            //     h('xl') && 'gap-4 p-8'
            // )}
            className={cn('w-full h-full flex flex-col')}
        ><CardHeader>
            <CardTitle>Control Center</CardTitle>
            <CardDescription>Control the subtitle and video</CardDescription>
        </CardHeader>
            <CardContent
                className={cn("grid place-content-start overflow-y-auto gap-y-4 w-full h-0 flex-1 pt-1",
                    "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded"
                )}
                style={{
                    "gridTemplateColumns": "repeat(auto-fit, minmax(150px, 1fr))", /* 修改最小宽度和列数以适应你的需求 */
                    // "gap": "1rem", /* 可选的间距 */
                }}
            >
                {/*<div*/}
                {/*    className={cn(*/}
                {/*        'flex gap-16 flex-wrap items-center justify-start  flex-1 w-full h-0 overflow-auto',*/}
                {/*        'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-thumb-rounded scrollbar-track-gray-100 scrollbar-track-rounded'*/}
                {/*    )}*/}
                {/*>*/}
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={showEn}
                        onCheckedChange={() => changeShowEn()}
                        id="showEn"
                    />
                    <Label htmlFor="showEn">展示英文字幕</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={showCn}
                        onCheckedChange={() => changeShowCn()}
                        id="showCn"
                    />
                    <Label htmlFor="showCn">展示中文字幕</Label>
                </div>
                {/*<div className="flex items-center space-x-2">*/}
                {/*    <Switch*/}
                {/*        checked={showWordLevel}*/}
                {/*        onCheckedChange={() => changeShowWordLevel()}*/}
                {/*        id="showWordLevel"*/}
                {/*    />*/}
                {/*    <Label htmlFor="showWordLevel">展示生词翻译</Label>*/}
                {/*</div>*/}
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={singleRepeat}
                        onCheckedChange={() => changeSingleRepeat()}
                        id="singleRepeat"
                    />
                    <Label htmlFor="singleRepeat">单句循环</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={setting('appearance.theme') === 'dark'}
                        onCheckedChange={() => {
                            setSetting('appearance.theme', setting('appearance.theme') === 'dark' ? 'light' : 'dark');
                        }}
                        id="nightMode"
                    />
                    <Label htmlFor="nightMode">夜间模式</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={fullScreen}
                        onCheckedChange={() => {
                            changeFullScreen(!fullScreen);
                        }}
                        id="fullScreen"
                    />
                    <Label htmlFor="fullScreen">全屏模式</Label>
                </div>
                <div className="flex items-center space-x-2">
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
                                icon: '👏',
                            });
                        }}
                        id="clearAllAdjust"
                    />
                    <Label htmlFor="clearAllAdjust">清除时间调整</Label>
                </div>
                {/*</div>*/}
            </CardContent>
        </Card>
    );
};

export default ControlBox;
