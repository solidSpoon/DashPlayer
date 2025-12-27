import * as React from 'react';
import ItemWrapper from '@/fronted/pages/setting/components/form/ItemWrapper';
import Header from '@/fronted/pages/setting/components/form/Header';
import Separator from '@/fronted/components/shared/common/Separator';
import { Button } from '@/fronted/components/ui/button';
import { Label } from '@/fronted/components/ui/label';
import { Input } from '@/fronted/components/ui/input';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import { DialogClose } from '@radix-ui/react-dialog';
import { cn } from '@/fronted/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/fronted/components/ui/dialog';
import { EllipsisVertical, Eraser, SquarePlus } from 'lucide-react';
import { SettingKeyObj } from '@/common/types/store_schema';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/fronted/components/ui/dropdown-menu';
import { useForm, Controller } from 'react-hook-form';
import useSetting from '@/fronted/hooks/useSetting';
import { useShallow } from 'zustand/react/shallow';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;

const merge = (a: string, b: string) => {
    const aArr = a.split(',');
    const bArr = b.split(',');
    const res = Array.from(new Set([...aArr, ...bArr])).join(',');
    return res;
};

type ShortcutKey =
    | 'shortcut.previousSentence'
    | 'shortcut.nextSentence'
    | 'shortcut.repeatSentence'
    | 'shortcut.playPause'
    | 'shortcut.repeatSingleSentence'
    | 'shortcut.autoPause'
    | 'shortcut.toggleEnglishDisplay'
    | 'shortcut.toggleChineseDisplay'
    | 'shortcut.toggleBilingualDisplay'
    | 'shortcut.toggleWordLevelDisplay'
    | 'shortcut.nextTheme'
    | 'shortcut.adjustBeginMinus'
    | 'shortcut.adjustBeginPlus'
    | 'shortcut.adjustEndMinus'
    | 'shortcut.adjustEndPlus'
    | 'shortcut.clearAdjust'
    | 'shortcut.nextPlaybackRate'
    | 'shortcut.aiChat'
    | 'shortcut.toggleCopyMode'
    | 'shortcut.addClip'
    | 'shortcut.openControlPanel';

const shortcutKeys: ShortcutKey[] = [
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
    'shortcut.addClip',
    'shortcut.openControlPanel',
];

type ShortcutFormValues = Record<ShortcutKey, string>;

type ShortCutRecorderProps = {
    title: string;
    description?: string;
    placeHolder?: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    type?: string;
    inputWidth?: string;
    defaultValue?: string;
};

const ShortCutRecorder: React.FC<ShortCutRecorderProps> = ({
    title,
    description,
    placeHolder,
    value,
    onChange,
    onBlur,
    type,
    inputWidth,
    defaultValue,
}) => {
    const [keys, { start, stop }] = useRecordHotkeys();
    const trigger = React.useRef<HTMLButtonElement>(null);

    return (
        <div className={cn('grid w-full items-center gap-1.5 pl-2')}>
            <Label>{title}</Label>
            <div className="flex justify-start">
                <Input
                    className={cn('mr-2', inputWidth)}
                    type={type}
                    value={value}
                    onBlur={onBlur}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeHolder}
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                            <EllipsisVertical />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem
                            onClick={() => {
                                trigger.current?.click();
                            }}
                        >
                            <SquarePlus className="h-4 w-4 mr-2" />
                            录制快捷键
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange(defaultValue ?? '')}
                        >
                            <Eraser className="h-4 w-4 mr-2" />
                            重置为默认值
                        </DropdownMenuItem>
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
                        <Button ref={trigger} className="hidden">
                            Open
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>录入快捷键</DialogTitle>
                            <DialogDescription>
                                点击下面的输入框, 然后按下你想要的快捷键
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Label htmlFor="shortcut-input" className="">
                                {title}
                            </Label>
                            <Input
                                id="shortcut-input"
                                readOnly
                                onFocus={start}
                                onBlur={stop}
                                value={Array.from(keys).join(' + ')}
                                className="col-span-3"
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    onClick={() => {
                                        onChange(merge(value, Array.from(keys).join('+')));
                                    }}
                                    type="submit"
                                >
                                    Save changes
                                </Button>
                            </DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <p className={cn('text-sm text-muted-foreground')}>{description}</p>
        </div>
    );
};

ShortCutRecorder.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-96',
    description: '',
    defaultValue: '',
};

const ShortcutSetting = () => {
    const shortcutValues = useSetting(
        useShallow((state) => {
            const result = {} as ShortcutFormValues;
            shortcutKeys.forEach((key) => {
                result[key] = state.values.get(key) ?? SettingKeyObj[key];
            });
            return result;
        })
    );

    const form = useForm<ShortcutFormValues>({
        defaultValues: shortcutValues,
    });

    const { control, watch, getValues, reset, formState } = form;
    const { isDirty } = formState;

    const [, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [, setAutoSaveError] = React.useState<string | null>(null);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveRef = React.useRef<Promise<void> | null>(null);
    const autoSaveIdleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = React.useRef(true);

    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    React.useEffect(() => {
        if (!isDirty) {
            reset(shortcutValues, { keepValues: true });
        }
    }, [shortcutValues, reset, isDirty]);

    const saveSettings = React.useCallback(async (values: ShortcutFormValues) => {
        await api.call('settings/shortcuts/update', values);
    }, []);

    const runSave = React.useCallback(async (values: ShortcutFormValues) => {
        if (autoSaveIdleTimerRef.current) {
            clearTimeout(autoSaveIdleTimerRef.current);
            autoSaveIdleTimerRef.current = null;
        }
        if (isMountedRef.current) {
            setAutoSaveStatus('saving');
            setAutoSaveError(null);
        }
        const promise = (async () => {
            try {
                await saveSettings(values);
                if (isMountedRef.current) {
                    setAutoSaveStatus('saved');
                    reset(values, { keepValues: true });
                    autoSaveIdleTimerRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
                        }
                    }, 2000);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (isMountedRef.current) {
                    setAutoSaveStatus('error');
                    setAutoSaveError(message);
                }
                throw error;
            }
        })();

        pendingSaveRef.current = promise;
        promise.finally(() => {
            if (pendingSaveRef.current === promise) {
                pendingSaveRef.current = null;
            }
        });
        return promise;
    }, [reset, saveSettings]);

    const flushPendingSave = React.useCallback(async () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (pendingSaveRef.current) {
            await pendingSaveRef.current;
            return;
        }
        if (!isDirty) {
            return;
        }
        await runSave(getValues());
        if (pendingSaveRef.current) {
            await pendingSaveRef.current;
        }
    }, [getValues, isDirty, runSave]);

    React.useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            if (autoSaveIdleTimerRef.current) {
                clearTimeout(autoSaveIdleTimerRef.current);
                autoSaveIdleTimerRef.current = null;
            }
            flushPendingSave().catch(() => undefined);
        };
    }, [flushPendingSave]);

    React.useEffect(() => {
        const subscription = watch(() => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (!formState.isDirty) {
                return;
            }
            debounceRef.current = setTimeout(() => {
                runSave(getValues()).catch(() => undefined);
            }, 600);
        });
        return () => subscription.unsubscribe();
    }, [getValues, runSave, watch, formState.isDirty]);

    return (
        <form className="h-full overflow-y-auto flex flex-col gap-4">
            <Header title="快捷键" description="多个快捷键用 , 分割" />
            <Separator orientation="horizontal" className="px-0" />
            <ItemWrapper>
                <Controller
                    name="shortcut.previousSentence"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="上一句"
                            description="跳转到上一句"
                            defaultValue={SettingKeyObj['shortcut.previousSentence']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.nextSentence"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="下一句"
                            description="跳转到下一句"
                            defaultValue={SettingKeyObj['shortcut.nextSentence']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.repeatSentence"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="重复当前句（循环）"
                            description="重复播放当前句"
                            defaultValue={SettingKeyObj['shortcut.repeatSentence']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.playPause"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="播放/暂停"
                            description="播放或暂停"
                            defaultValue={SettingKeyObj['shortcut.playPause']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.repeatSingleSentence"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="单句循环"
                            description="重复播放当前句子一次"
                            defaultValue={SettingKeyObj['shortcut.repeatSingleSentence']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.autoPause"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="自动暂停"
                            description="播放一句后自动暂停"
                            defaultValue={SettingKeyObj['shortcut.autoPause']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.toggleEnglishDisplay"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="显示英语字幕"
                            description="切换是否显示英语字幕"
                            defaultValue={SettingKeyObj['shortcut.toggleEnglishDisplay']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.toggleChineseDisplay"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="显示中文字幕"
                            description="切换是否显示中文字幕"
                            defaultValue={SettingKeyObj['shortcut.toggleChineseDisplay']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.toggleBilingualDisplay"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="显示双语字幕"
                            description="切换是否显示双语字幕"
                            defaultValue={SettingKeyObj['shortcut.toggleBilingualDisplay']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.toggleWordLevelDisplay"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="显示逐词字幕"
                            description="切换逐词字幕"
                            defaultValue={SettingKeyObj['shortcut.toggleWordLevelDisplay']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.nextTheme"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="切换主题"
                            description="在不同主题之间切换"
                            defaultValue={SettingKeyObj['shortcut.nextTheme']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.adjustBeginMinus"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="字幕开始时间提前"
                            description="将字幕开始时间提前"
                            defaultValue={SettingKeyObj['shortcut.adjustBeginMinus']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.adjustBeginPlus"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="字幕开始时间延后"
                            description="将字幕开始时间延后"
                            defaultValue={SettingKeyObj['shortcut.adjustBeginPlus']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.adjustEndMinus"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="字幕结束时间提前"
                            description="将字幕结束时间提前"
                            defaultValue={SettingKeyObj['shortcut.adjustEndMinus']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.adjustEndPlus"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="字幕结束时间延后"
                            description="将字幕结束时间延后"
                            defaultValue={SettingKeyObj['shortcut.adjustEndPlus']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.clearAdjust"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="清除字幕偏移"
                            description="恢复字幕时间到默认值"
                            defaultValue={SettingKeyObj['shortcut.clearAdjust']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.nextPlaybackRate"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="切换播放速度"
                            description="在常用播放速度之间循环切换"
                            defaultValue={SettingKeyObj['shortcut.nextPlaybackRate']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.aiChat"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="打开 AI 对话"
                            description="唤起 AI 对话窗口"
                            defaultValue={SettingKeyObj['shortcut.aiChat']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.toggleCopyMode"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="切换复制模式"
                            description="切换字幕复制模式"
                            defaultValue={SettingKeyObj['shortcut.toggleCopyMode']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.addClip"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="添加收藏片段"
                            description="将当前字幕加入收藏夹"
                            defaultValue={SettingKeyObj['shortcut.addClip']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                <Controller
                    name="shortcut.openControlPanel"
                    control={control}
                    render={({ field }) => (
                        <ShortCutRecorder
                            title="打开控制面板"
                            description="打开播放器控制面板"
                            defaultValue={SettingKeyObj['shortcut.openControlPanel']}
                            value={field.value ?? ''}
                            onChange={(value) => field.onChange(value)}
                            onBlur={field.onBlur}
                        />
                    )}
                />
            </ItemWrapper>
        </form>
    );
};

export default ShortcutSetting;
