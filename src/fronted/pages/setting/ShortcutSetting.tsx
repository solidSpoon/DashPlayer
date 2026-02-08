import * as React from 'react';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
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
import { useTranslation as useI18nTranslation } from 'react-i18next';

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
    recordLabel: string;
    resetDefaultLabel: string;
    dialogTitle: string;
    dialogDescription: string;
    saveChangesLabel: string;
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
    recordLabel,
    resetDefaultLabel,
    dialogTitle,
    dialogDescription,
    saveChangesLabel,
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
                            {recordLabel}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onChange(defaultValue ?? '')}
                        >
                            <Eraser className="h-4 w-4 mr-2" />
                            {resetDefaultLabel}
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
                            <DialogTitle>{dialogTitle}</DialogTitle>
                            <DialogDescription>
                                {dialogDescription}
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
                                    {saveChangesLabel}
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
    const { t } = useI18nTranslation('settings');
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

    const items: Array<{ key: ShortcutKey; title: string; description: string }> = [
        { key: 'shortcut.previousSentence', title: t('shortcut.items.previousSentence.title'), description: t('shortcut.items.previousSentence.description') },
        { key: 'shortcut.nextSentence', title: t('shortcut.items.nextSentence.title'), description: t('shortcut.items.nextSentence.description') },
        { key: 'shortcut.repeatSentence', title: t('shortcut.items.repeatSentence.title'), description: t('shortcut.items.repeatSentence.description') },
        { key: 'shortcut.playPause', title: t('shortcut.items.playPause.title'), description: t('shortcut.items.playPause.description') },
        { key: 'shortcut.repeatSingleSentence', title: t('shortcut.items.repeatSingleSentence.title'), description: t('shortcut.items.repeatSingleSentence.description') },
        { key: 'shortcut.autoPause', title: t('shortcut.items.autoPause.title'), description: t('shortcut.items.autoPause.description') },
        { key: 'shortcut.toggleEnglishDisplay', title: t('shortcut.items.toggleEnglishDisplay.title'), description: t('shortcut.items.toggleEnglishDisplay.description') },
        { key: 'shortcut.toggleChineseDisplay', title: t('shortcut.items.toggleChineseDisplay.title'), description: t('shortcut.items.toggleChineseDisplay.description') },
        { key: 'shortcut.toggleBilingualDisplay', title: t('shortcut.items.toggleBilingualDisplay.title'), description: t('shortcut.items.toggleBilingualDisplay.description') },
        { key: 'shortcut.toggleWordLevelDisplay', title: t('shortcut.items.toggleWordLevelDisplay.title'), description: t('shortcut.items.toggleWordLevelDisplay.description') },
        { key: 'shortcut.nextTheme', title: t('shortcut.items.nextTheme.title'), description: t('shortcut.items.nextTheme.description') },
        { key: 'shortcut.adjustBeginMinus', title: t('shortcut.items.adjustBeginMinus.title'), description: t('shortcut.items.adjustBeginMinus.description') },
        { key: 'shortcut.adjustBeginPlus', title: t('shortcut.items.adjustBeginPlus.title'), description: t('shortcut.items.adjustBeginPlus.description') },
        { key: 'shortcut.adjustEndMinus', title: t('shortcut.items.adjustEndMinus.title'), description: t('shortcut.items.adjustEndMinus.description') },
        { key: 'shortcut.adjustEndPlus', title: t('shortcut.items.adjustEndPlus.title'), description: t('shortcut.items.adjustEndPlus.description') },
        { key: 'shortcut.clearAdjust', title: t('shortcut.items.clearAdjust.title'), description: t('shortcut.items.clearAdjust.description') },
        { key: 'shortcut.nextPlaybackRate', title: t('shortcut.items.nextPlaybackRate.title'), description: t('shortcut.items.nextPlaybackRate.description') },
        { key: 'shortcut.aiChat', title: t('shortcut.items.aiChat.title'), description: t('shortcut.items.aiChat.description') },
        { key: 'shortcut.toggleCopyMode', title: t('shortcut.items.toggleCopyMode.title'), description: t('shortcut.items.toggleCopyMode.description') },
        { key: 'shortcut.addClip', title: t('shortcut.items.addClip.title'), description: t('shortcut.items.addClip.description') },
        { key: 'shortcut.openControlPanel', title: t('shortcut.items.openControlPanel.title'), description: t('shortcut.items.openControlPanel.description') },
    ];

    return (
        <form className="w-full h-full min-h-0">
            <SettingsPageShell
                title={t('shortcut.title')}
                description={t('shortcut.description')}
                contentClassName="space-y-8"
            >
                {items.map((item) => (
                    <Controller
                        key={item.key}
                        name={item.key}
                        control={control}
                        render={({ field }) => (
                            <ShortCutRecorder
                                title={item.title}
                                description={item.description}
                                defaultValue={SettingKeyObj[item.key]}
                                value={field.value ?? ''}
                                onChange={(value) => field.onChange(value)}
                                onBlur={field.onBlur}
                                recordLabel={t('shortcut.record')}
                                resetDefaultLabel={t('shortcut.resetDefault')}
                                dialogTitle={t('shortcut.dialogTitle')}
                                dialogDescription={t('shortcut.dialogDescription')}
                                saveChangesLabel={t('shortcut.saveChanges')}
                            />
                        )}
                    />
                ))}
            </SettingsPageShell>
        </form>
    );
};

export default ShortcutSetting;
