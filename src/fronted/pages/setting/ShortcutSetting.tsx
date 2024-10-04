import ItemWrapper from '@/fronted/components/setting/ItemWrapper';
import FooterWrapper from '@/fronted/components/setting/FooterWrapper';
import Header from '@/fronted/components/setting/Header';
import useSettingForm from '@/fronted/hooks/useSettingForm';
import Separator from '@/fronted/components/Separtor';
import { Button } from '@/fronted/components/ui/button';
import { Label } from '@/fronted/components/ui/label';
import { Input } from '@/fronted/components/ui/input';
import * as React from 'react';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import { DialogClose } from '@radix-ui/react-dialog';
import { cn } from '@/fronted/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription, DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/fronted/components/ui/dialog';
import { EllipsisVertical, Eraser, SquarePlus } from 'lucide-react';
import { SettingKeyObj } from '@/common/types/store_schema';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/fronted/components/ui/dropdown-menu';
import { Nullable } from '@/common/types/Types';

const merge = (a: string, b: string) => {
    const aArr = a.split(',');
    const bArr = b.split(',');
    const res = Array.from(new Set([...aArr, ...bArr])).join(',');
    return res;
};
const ShortCutRecorder = ({
                              title,
                              description,
                              placeHolder,
                              value,
                              setValue,
                              type,
                              inputWidth,
                              defaultValue
                          }: {
    title: string;
    placeHolder?: string;
    value: string;
    setValue: (value: string) => void;
    type?: string;
    inputWidth?: string;
    description?: string;
    defaultValue?: string;
}) => {
    // 打印快捷键
    // const [open, setOpen] = React.useState(false);
    const [keys, { start, stop, isRecording }] = useRecordHotkeys();
    // const [recordOpen, setRecordOpen] = React.useState(false);
    const trigger = React.useRef<HTMLButtonElement>(null);
    return (
        <div className={cn('grid w-full items-center gap-1.5 pl-2')}>
            <Label>{title}</Label>
            <div className={'flex justify-start'}>
                <Input
                    className={cn('mr-2', inputWidth)}
                    type={type}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={placeHolder} />
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button variant={'outline'} size={'icon'}>
                            <EllipsisVertical />
                        </Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem
                            onClick={() => {
                                // setRecordOpen(true);
                                trigger.current?.click();
                            }}
                        ><SquarePlus className={'h-4 w-4 mr-2'} />录制快捷键</DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => setValue(defaultValue ?? '')}
                        ><Eraser className={'h-4 w-4 mr-2'} />重置为默认值</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Dialog
                    onOpenChange={(open) => {
                        if (!open) {
                            stop();
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button
                            ref={trigger}
                            className={'hidden'}>Open</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>录入快捷键</DialogTitle>
                            <DialogDescription>
                                点击下面的输入框, 然后按下你想要的快捷键
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Label htmlFor="name" className="">
                                {title}
                            </Label>
                            <Input
                                readOnly
                                onFocus={start}
                                onBlur={stop}
                                value={Array.from(keys).join(' + ')}
                                id="name"
                                className="col-span-3"
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    onClick={() => {
                                        setValue(merge(value, Array.from(keys).join('+')));
                                        // setRecordOpen(false);
                                    }}
                                    type="submit">Save changes</Button>
                            </DialogClose>

                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <p

                className={cn('text-sm text-muted-foreground')}

            >
                {description}
            </p>
        </div>
    );
};
ShortCutRecorder.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-96',
    description: '',
    defaultValue: ''
};

const ShortcutSetting = () => {
    const { setting, setSettingFunc, submit, eqServer } = useSettingForm([
        'shortcut.previousSentence',
        'shortcut.nextSentence',
        'shortcut.repeatSentence',
        'shortcut.playPause',
        'shortcut.repeatSingleSentence',
        'shortcut.autoPause',
        'shortcut.toggleEnglishDisplay',
        'shortcut.toggleChineseDisplay',
        'shortcut.toggleBilingualDisplay',
        'shortcut.toggleWordLevelDisplay',
        'shortcut.nextTheme',
        'shortcut.adjustBeginMinus',
        'shortcut.adjustBeginPlus',
        'shortcut.adjustEndMinus',
        'shortcut.adjustEndPlus',
        'shortcut.clearAdjust',
        'shortcut.nextPlaybackRate',
        'shortcut.aiChat',
        'shortcut.toggleCopyMode',
        'shortcut.addClip'
    ]);
    return (
        <form className="h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <Separator orientation="horizontal" className="px-0" />
            <ItemWrapper>
                {/*<div className={'flex justify-start'}>*/}
                <ShortCutRecorder
                    title="上一句"
                    description="跳转到上一句"
                    defaultValue={SettingKeyObj['shortcut.previousSentence']}
                    value={setting('shortcut.previousSentence')}
                    setValue={setSettingFunc('shortcut.previousSentence')}
                />

                <ShortCutRecorder
                    title="下一句"
                    description="跳转到下一句"
                    defaultValue={SettingKeyObj['shortcut.nextSentence']}
                    value={setting('shortcut.nextSentence')}
                    setValue={setSettingFunc('shortcut.nextSentence')}
                />
                <ShortCutRecorder
                    title="重复"
                    description="重复当前句子"
                    defaultValue={SettingKeyObj['shortcut.repeatSentence']}
                    value={setting('shortcut.repeatSentence')}
                    setValue={setSettingFunc('shortcut.repeatSentence')}
                />
                <ShortCutRecorder
                    title="播放/暂停"
                    description="播放/暂停"
                    defaultValue={SettingKeyObj['shortcut.playPause']}
                    value={setting('shortcut.playPause')}
                    setValue={setSettingFunc('shortcut.playPause')}
                />
                <ShortCutRecorder
                    title="单句重复"
                    description="自动重复当前句子"
                    defaultValue={SettingKeyObj['shortcut.repeatSingleSentence']}
                    value={setting('shortcut.repeatSingleSentence')}
                    setValue={setSettingFunc('shortcut.repeatSingleSentence')}
                />
                <ShortCutRecorder
                    title="自动暂停"
                    description="当前句子播放完后自动暂停"
                    defaultValue={SettingKeyObj['shortcut.autoPause']}
                    value={setting('shortcut.autoPause')}
                    setValue={setSettingFunc('shortcut.autoPause')}
                />
                <ShortCutRecorder
                    title="展示/隐藏英文"
                    description="展示/隐藏英文字幕"
                    defaultValue={SettingKeyObj['shortcut.toggleEnglishDisplay']}
                    value={setting('shortcut.toggleEnglishDisplay')}
                    setValue={setSettingFunc('shortcut.toggleEnglishDisplay')}
                />
                <ShortCutRecorder
                    title="展示/隐藏中文"
                    description="展示/隐藏中文字幕"
                    defaultValue={SettingKeyObj['shortcut.toggleChineseDisplay']}
                    value={setting('shortcut.toggleChineseDisplay')}
                    setValue={setSettingFunc('shortcut.toggleChineseDisplay')}
                />
                <ShortCutRecorder
                    title="展示/隐藏中英"
                    description="展示/隐藏中英文字幕"
                    defaultValue={SettingKeyObj['shortcut.toggleBilingualDisplay']}
                    value={setting('shortcut.toggleBilingualDisplay')}
                    setValue={setSettingFunc('shortcut.toggleBilingualDisplay')}
                />
                <ShortCutRecorder
                    title="切换主题"
                    description="切换播放器的明亮/暗黑主题"
                    defaultValue={SettingKeyObj['shortcut.nextTheme']}
                    value={setting('shortcut.nextTheme')}
                    setValue={setSettingFunc('shortcut.nextTheme')}
                />
                <ShortCutRecorder
                    title="切换播放速度"
                    description="在播放器速度选择弹窗勾选的速度中切换"
                    defaultValue={SettingKeyObj['shortcut.nextPlaybackRate']}
                    value={setting('shortcut.nextPlaybackRate')}
                    setValue={setSettingFunc('shortcut.nextPlaybackRate')} />
                <ShortCutRecorder
                    title="开始时间 -"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的开始时间"
                    defaultValue={SettingKeyObj['shortcut.adjustBeginMinus']}
                    value={setting('shortcut.adjustBeginMinus')}
                    setValue={setSettingFunc('shortcut.adjustBeginMinus')}
                />
                <ShortCutRecorder
                    title="开始时间 +"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的开始时间"
                    defaultValue={SettingKeyObj['shortcut.adjustBeginPlus']}
                    value={setting('shortcut.adjustBeginPlus')}
                    setValue={setSettingFunc('shortcut.adjustBeginPlus')}
                />
                <ShortCutRecorder
                    title="结束时间 -"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的结束时间"
                    defaultValue={SettingKeyObj['shortcut.adjustEndMinus']}
                    value={setting('shortcut.adjustEndMinus')}
                    setValue={setSettingFunc('shortcut.adjustEndMinus')}
                />
                <ShortCutRecorder
                    title="结束时间 +"
                    description="当精听一句话时, 可能遇到字幕时间不准确的情况, 可以通过这个快捷键来调整字幕的结束时间"
                    defaultValue={SettingKeyObj['shortcut.adjustEndPlus']}
                    value={setting('shortcut.adjustEndPlus')}
                    setValue={setSettingFunc('shortcut.adjustEndPlus')}
                />
                <ShortCutRecorder
                    title="重置时间调整"
                    description="调整后可以用这个快捷键重置当前句子的时间"
                    defaultValue={SettingKeyObj['shortcut.clearAdjust']}
                    value={setting('shortcut.clearAdjust')}
                    setValue={setSettingFunc('shortcut.clearAdjust')}
                />
                <ShortCutRecorder
                    title="整句学习面板"
                    description="打开/关闭整句学习面板"
                    defaultValue={SettingKeyObj['shortcut.aiChat']}
                    value={setting('shortcut.aiChat')}
                    setValue={setSettingFunc('shortcut.aiChat')}
                />
                <ShortCutRecorder
                    title="复制模式"
                    description="打开/关闭复制模式，长按后点击单词即可复制，点击句子空白处为复制句子"
                    defaultValue={SettingKeyObj['shortcut.toggleCopyMode']}
                    value={setting('shortcut.toggleCopyMode')}
                    setValue={setSettingFunc('shortcut.toggleCopyMode')}
                />
                <ShortCutRecorder
                    title="添加/取消收藏"
                    description="使用这个快捷键可以添加/取消收藏当前句子"
                    defaultValue={SettingKeyObj['shortcut.addClip']}
                    value={setting('shortcut.addClip')}
                    setValue={setSettingFunc('shortcut.addClip')}
                />
            </ItemWrapper>

            <FooterWrapper>
                <Button
                    onClick={submit}
                    disabled={eqServer}
                >
                    Apply
                </Button>

            </FooterWrapper>
        </form>
    );
};
export default ShortcutSetting;
