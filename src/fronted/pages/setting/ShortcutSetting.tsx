import * as React from 'react';
import SettingsPageShell from '@/fronted/pages/setting/components/form/SettingsPageShell';
import { Button } from '@/fronted/components/ui/button';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import { DialogClose } from '@radix-ui/react-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/fronted/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/fronted/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/fronted/components/ui/tooltip';
import { Eraser, Pencil, X } from 'lucide-react';
import { SettingKeyObj } from '@/common/types/store_schema';
import { useForm, Controller } from 'react-hook-form';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Input } from '@/fronted/components/ui/input';
import { Label } from '@/fronted/components/ui/label';
import { useAutoSaveSettingsForm } from '@/fronted/hooks/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';

const api = backendClient;

/**
 * 解析快捷键字符串，规范化并去重。
 */
const parseShortcutList = (value: string): string[] => Array.from(new Set(
    value
        .split(',')
        .map((item) => item.trim().replaceAll(' ', ''))
        .filter((item) => item !== ''),
));

/**
 * 将快捷键数组转为配置存储的逗号分隔字符串。
 */
const stringifyShortcutList = (shortcuts: string[]): string => shortcuts.join(',');

/**
 * 将快捷键字段名转换为配置仓库里的 `shortcut.xxx` 键名。
 */
const toShortcutStoreKey = (key: ShortcutKey): ShortcutStoreKey => `shortcut.${key}`;

/**
 * 录制快捷键弹窗：根据模式执行“追加”或“覆盖”保存。
 */
const RecordDialog = ({
    title,
    value,
    defaultValue,
    onChange,
    triggerRef,
    dialogTitle,
    dialogDescription,
    saveChangesLabel,
    currentShortcutsLabel,
    emptyShortcutsLabel,
    addRecordedLabel,
    removeShortcutLabel,
    resetDefaultLabel,
}: {
    title: string;
    value: string;
    defaultValue: string;
    onChange: (value: string) => void;
    triggerRef: React.RefObject<HTMLButtonElement>;
    dialogTitle: string;
    dialogDescription: string;
    saveChangesLabel: string;
    currentShortcutsLabel: string;
    emptyShortcutsLabel: string;
    addRecordedLabel: string;
    removeShortcutLabel: string;
    resetDefaultLabel: string;
}) => {
    const [keys, { start, stop }] = useRecordHotkeys();
    const [open, setOpen] = React.useState(false);
    const [shortcuts, setShortcuts] = React.useState<string[]>([]);

    /**
     * 从当前录制状态提取规范化快捷键字符串。
     */
    const getRecordedShortcut = React.useCallback((): string => {
        return Array.from(keys).join('+').trim().replaceAll(' ', '');
    }, [keys]);

    /**
     * 将录制到的快捷键追加到草稿列表，自动去重。
     */
    const appendRecordedShortcut = React.useCallback(() => {
        const recordedShortcut = getRecordedShortcut();
        if (!recordedShortcut) {
            return;
        }
        setShortcuts((previous) => Array.from(new Set([...previous, recordedShortcut])));
    }, [getRecordedShortcut]);

    /**
     * 从草稿列表移除指定快捷键。
     */
    const removeShortcut = React.useCallback((shortcut: string) => {
        setShortcuts((previous) => previous.filter((item) => item !== shortcut));
    }, []);

    /**
     * 保存弹窗内草稿并回写到表单字段。
     */
    const submitChanges = React.useCallback(() => {
        onChange(stringifyShortcutList(shortcuts));
    }, [onChange, shortcuts]);

    /**
     * 重置为默认值（仅更新草稿，不立即生效）。
     */
    const resetToDefault = React.useCallback(() => {
        setShortcuts(parseShortcutList(defaultValue));
    }, [defaultValue]);

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setShortcuts(parseShortcutList(value));
                    return;
                }
                stop();
            }}
        >
            <DialogTrigger asChild>
                <Button ref={triggerRef} className="hidden">Open</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="shortcut-input">{title}</Label>
                        <div className="flex gap-2">
                            <Input
                                id="shortcut-input"
                                readOnly
                                onFocus={start}
                                onBlur={stop}
                                value={Array.from(keys).join(' + ')}
                                className="flex-1"
                            />
                            <Button type="button" variant="outline" onClick={appendRecordedShortcut}>
                                {addRecordedLabel}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{currentShortcutsLabel}</div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={resetToDefault}
                            >
                                <Eraser className="h-3 w-3 mr-1" />
                                {resetDefaultLabel}
                            </Button>
                        </div>
                        {shortcuts.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2">{emptyShortcutsLabel}</div>
                        ) : (
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-border bg-muted/30 min-h-[60px]">
                                {shortcuts.map((shortcut) => (
                                    <span key={shortcut} className="inline-flex items-center rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground shadow-sm">
                                        {shortcut.split('+').map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(' + ')}
                                        <button
                                            type="button"
                                            className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-destructive transition-colors"
                                            title={removeShortcutLabel}
                                            onClick={() => removeShortcut(shortcut)}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            onClick={submitChanges}
                            type="submit"
                        >
                            {saveChangesLabel}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

/**
 * 快捷键设置页面：展示全部动作并支持自动保存。
 */
const ShortcutSetting = () => {
    const { t } = useI18nTranslation('settings');
    const { data: shortcutValues } = useSWR<ShortcutSettingDetailVO>(
        'settings/shortcuts/detail',
        () => api.call('settings/shortcuts/detail'),
    );

    const form = useForm<ShortcutFormValues>();

    const { control } = form;
    const { ready, status: autoSaveStatus, error: autoSaveError, initialize, flush } = useAutoSaveSettingsForm<ShortcutFormValues>({
        form,
        onSave: async (values) => {
            await api.call('settings/shortcuts/save', values);
        },
    });

    React.useEffect(() => {
        if (!shortcutValues) {
            return;
        }
        initialize(shortcutValues);
    }, [initialize, shortcutValues]);

    const items: Array<{ key: ShortcutKey; title: string; description: string }> = [
        { key: 'previousSentence', title: t('shortcut.items.previousSentence.title'), description: t('shortcut.items.previousSentence.description') },
        { key: 'nextSentence', title: t('shortcut.items.nextSentence.title'), description: t('shortcut.items.nextSentence.description') },
        { key: 'repeatSentence', title: t('shortcut.items.repeatSentence.title'), description: t('shortcut.items.repeatSentence.description') },
        { key: 'playPause', title: t('shortcut.items.playPause.title'), description: t('shortcut.items.playPause.description') },
        { key: 'repeatSingleSentence', title: t('shortcut.items.repeatSingleSentence.title'), description: t('shortcut.items.repeatSingleSentence.description') },
        { key: 'autoPause', title: t('shortcut.items.autoPause.title'), description: t('shortcut.items.autoPause.description') },
        { key: 'toggleEnglishDisplay', title: t('shortcut.items.toggleEnglishDisplay.title'), description: t('shortcut.items.toggleEnglishDisplay.description') },
        { key: 'toggleChineseDisplay', title: t('shortcut.items.toggleChineseDisplay.title'), description: t('shortcut.items.toggleChineseDisplay.description') },
        { key: 'toggleBilingualDisplay', title: t('shortcut.items.toggleBilingualDisplay.title'), description: t('shortcut.items.toggleBilingualDisplay.description') },
        { key: 'toggleWordLevelDisplay', title: t('shortcut.items.toggleWordLevelDisplay.title'), description: t('shortcut.items.toggleWordLevelDisplay.description') },
        { key: 'nextTheme', title: t('shortcut.items.nextTheme.title'), description: t('shortcut.items.nextTheme.description') },
        { key: 'adjustBeginMinus', title: t('shortcut.items.adjustBeginMinus.title'), description: t('shortcut.items.adjustBeginMinus.description') },
        { key: 'adjustBeginPlus', title: t('shortcut.items.adjustBeginPlus.title'), description: t('shortcut.items.adjustBeginPlus.description') },
        { key: 'adjustEndMinus', title: t('shortcut.items.adjustEndMinus.title'), description: t('shortcut.items.adjustEndMinus.description') },
        { key: 'adjustEndPlus', title: t('shortcut.items.adjustEndPlus.title'), description: t('shortcut.items.adjustEndPlus.description') },
        { key: 'clearAdjust', title: t('shortcut.items.clearAdjust.title'), description: t('shortcut.items.clearAdjust.description') },
        { key: 'nextPlaybackRate', title: t('shortcut.items.nextPlaybackRate.title'), description: t('shortcut.items.nextPlaybackRate.description') },
        { key: 'aiChat', title: t('shortcut.items.aiChat.title'), description: t('shortcut.items.aiChat.description') },
        { key: 'addClip', title: t('shortcut.items.addClip.title'), description: t('shortcut.items.addClip.description') },
        { key: 'openControlPanel', title: t('shortcut.items.openControlPanel.title'), description: t('shortcut.items.openControlPanel.description') },
    ];

    return (
        <form
            className="w-full h-full min-h-0"
            onSubmit={(event) => {
                event.preventDefault();
                flush().catch(() => null);
            }}
        >
            <SettingsPageShell
                title={t('shortcut.title')}
                description={t('shortcut.description')}
            >
                {!ready && <div className="h-2" />}
                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}
                <TooltipProvider delayDuration={300}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">{t('shortcut.tableHeader.action')}</TableHead>
                                <TableHead>{t('shortcut.tableHeader.keys')}</TableHead>
                                <TableHead className="w-20" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => (
                                <Controller
                                    key={item.key}
                                    name={item.key}
                                    control={control}
                                    render={({ field }) => (
                                        <ShortcutRow
                                            title={item.title}
                                            description={item.description}
                                            value={field.value ?? ''}
                                            defaultValue={SettingKeyObj[toShortcutStoreKey(item.key)]}
                                            onChange={field.onChange}
                                            editLabel={t('shortcut.edit')}
                                            resetDefaultLabel={t('shortcut.resetDefault')}
                                            dialogTitle={t('shortcut.dialogTitle')}
                                            dialogDescription={t('shortcut.dialogDescription')}
                                            saveChangesLabel={t('shortcut.saveChanges')}
                                            currentShortcutsLabel={t('shortcut.dialogCurrentShortcuts')}
                                            emptyShortcutsLabel={t('shortcut.dialogNoShortcuts')}
                                            addRecordedLabel={t('shortcut.dialogAddRecorded')}
                                            removeShortcutLabel={t('shortcut.dialogRemoveShortcut')}
                                            dialogResetDefaultLabel={t('shortcut.dialogResetDefault')}
                                        />
                                    )}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </TooltipProvider>
            </SettingsPageShell>
        </form>
    );
};

/**
 * 单行快捷键配置项：提供编辑弹窗入口与恢复默认值操作。
 */
const ShortcutRow = ({
    title,
    description,
    value,
    defaultValue,
    onChange,
    editLabel,
    resetDefaultLabel,
    dialogTitle,
    dialogDescription,
    saveChangesLabel,
    currentShortcutsLabel,
    emptyShortcutsLabel,
    addRecordedLabel,
    removeShortcutLabel,
    dialogResetDefaultLabel,
}: {
    title: string;
    description: string;
    value: string;
    defaultValue: string;
    onChange: (value: string) => void;
    editLabel: string;
    resetDefaultLabel: string;
    dialogTitle: string;
    dialogDescription: string;
    saveChangesLabel: string;
    currentShortcutsLabel: string;
    emptyShortcutsLabel: string;
    addRecordedLabel: string;
    removeShortcutLabel: string;
    dialogResetDefaultLabel: string;
}) => {
    const triggerRef = React.useRef<HTMLButtonElement>(null!);
    return (
        <TableRow className="group/row">
            <TableCell className="py-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="text-sm cursor-default">{title}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>{description}</p>
                    </TooltipContent>
                </Tooltip>
            </TableCell>
            <TableCell className="py-2">
                <KeyBadge keys={value} />
            </TableCell>
            <TableCell className="py-2">
                <div className="flex items-center gap-0.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/95 hover:text-foreground" onClick={() => triggerRef.current?.click()}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>{editLabel}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/95 hover:text-foreground" onClick={() => onChange(defaultValue)}>
                                <Eraser className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>{resetDefaultLabel}</p></TooltipContent>
                    </Tooltip>
                </div>
                <RecordDialog
                    title={title}
                    value={value}
                    defaultValue={defaultValue}
                    onChange={onChange}
                    triggerRef={triggerRef}
                    dialogTitle={dialogTitle}
                    dialogDescription={dialogDescription}
                    saveChangesLabel={saveChangesLabel}
                    currentShortcutsLabel={currentShortcutsLabel}
                    emptyShortcutsLabel={emptyShortcutsLabel}
                    addRecordedLabel={addRecordedLabel}
                    removeShortcutLabel={removeShortcutLabel}
                    resetDefaultLabel={dialogResetDefaultLabel}
                />
            </TableCell>
        </TableRow>
    );
};

export default ShortcutSetting;
type ShortcutKey = keyof ShortcutSettingSaveVO;
type ShortcutStoreKey = `shortcut.${ShortcutKey}`;

type ShortcutFormValues = ShortcutSettingSaveVO;

const KeyBadge = ({ keys }: { keys: string }) => {
    if (!keys) return <span className="text-muted-foreground text-xs">—</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {keys.split(',').filter(Boolean).map((key) => (
                <kbd
                    key={key}
                    className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                >
                    {key.split('+').map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(' + ')}
                </kbd>
            ))}
        </div>
    );
};
