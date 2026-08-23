import * as React from 'react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { SettingCard, SettingsLoadingSkeleton } from '@/fronted/features/settings/components/form';
import { Button } from '@/fronted/components/ui/button';
import { useRecordHotkeys } from 'react-hotkeys-hook';
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
    TableRow,
} from '@/fronted/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/fronted/components/ui/tooltip';
import {
    Eraser,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    X,
    PlayCircle,
    Subtitles,
    Clock,
    Sparkles,
    Radio,
} from 'lucide-react';
import { SettingKeyObj } from '@/common/types/store_schema';
import { useForm, Controller } from 'react-hook-form';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Input } from '@/fronted/components/ui/input';
import { useAutoSaveSettingsForm } from '@/fronted/features/settings/useAutoSaveSettingsForm';
import useSWR from 'swr';
import { ShortcutSettingDetailVO, ShortcutSettingSaveVO } from '@/common/types/vo/shortcut-setting-vo';

/**
 * 格式化单个按键为标准符号或名称。
 */
const formatKeySymbol = (key: string): string => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
    const lower = key.toLowerCase();

    switch (lower) {
        case 'meta':
        case 'cmd':
        case 'command':
            return isMac ? '⌘' : 'Win';
        case 'alt':
        case 'option':
            return isMac ? '⌥' : 'Alt';
        case 'shift':
            return isMac ? '⇧' : 'Shift';
        case 'ctrl':
        case 'control':
            return isMac ? '⌃' : 'Ctrl';
        case 'space':
        case ' ':
            return 'Space';
        case 'enter':
        case 'return':
            return isMac ? '↩' : 'Enter';
        case 'backspace':
            return isMac ? '⌫' : 'Backspace';
        case 'escape':
        case 'esc':
            return 'Esc';
        case 'arrowup':
        case 'up':
            return '↑';
        case 'arrowdown':
        case 'down':
            return '↓';
        case 'arrowleft':
        case 'left':
            return '←';
        case 'arrowright':
        case 'right':
            return '→';
        case 'tab':
            return '⇥';
        default:
            return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
    }
};

/**
 * 现代拟物键帽组件
 */
const KeyCap = ({ label, className = '' }: { label: string; className?: string }) => (
    <kbd
        className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium rounded-md border border-border/80 bg-gradient-to-b from-background to-muted/80 text-foreground shadow-[0_1.5px_0_rgba(0,0,0,0.15),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_1.5px_0_rgba(255,255,255,0.1)] select-none ${className}`}
    >
        {formatKeySymbol(label)}
    </kbd>
);

/**
 * 快捷键组合展示组件
 */
const KeyBadge = ({ keys }: { keys: string }) => {
    if (!keys || keys.trim() === '') {
        return <span className="text-muted-foreground/60 text-xs italic">—</span>;
    }
    const list = keys.split(',').map((k) => k.trim()).filter(Boolean);
    return (
        <div className="flex flex-wrap gap-2 items-center">
            {list.map((shortcut) => (
                <div
                    key={shortcut}
                    className="inline-flex items-center gap-1 bg-muted/40 hover:bg-muted/70 px-1.5 py-1 rounded-md border border-border/50 transition-colors"
                >
                    {shortcut.split('+').map((k, idx) => (
                        <React.Fragment key={idx}>
                            {idx > 0 && <span className="text-[10px] text-muted-foreground/60 font-semibold">+</span>}
                            <KeyCap label={k} />
                        </React.Fragment>
                    ))}
                </div>
            ))}
        </div>
    );
};

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
 * 录制快捷键弹窗：提供一键录制、按键实体展示与多快捷键管理。
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
    listeningPrompt,
    clearAllLabel,
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
    listeningPrompt: string;
    clearAllLabel: string;
}) => {
    const [keys, { start, stop }] = useRecordHotkeys();
    const [open, setOpen] = React.useState(false);
    const [shortcuts, setShortcuts] = React.useState<string[]>([]);
    const [isListening, setIsListening] = React.useState(false);
    const recordContainerRef = React.useRef<HTMLDivElement>(null);

    const recordedShortcut = React.useMemo(() => {
        return Array.from(keys).join('+').trim().replaceAll(' ', '');
    }, [keys]);

    /**
     * 将录制到的快捷键追加到草稿列表，自动去重，并重置当前录制状态以准备下一次录制。
     */
    const appendRecordedShortcut = React.useCallback(() => {
        if (!recordedShortcut) {
            return;
        }
        setShortcuts((previous) => Array.from(new Set([...previous, recordedShortcut])));
        // 重新启动录制监听，清除上一轮按键
        stop();
        setTimeout(() => {
            start();
            recordContainerRef.current?.focus();
        }, 30);
    }, [recordedShortcut, start, stop]);

    /**
     * 清除当前录制状态，重新开始录制。
     */
    const handleRerecord = React.useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        stop();
        setTimeout(() => {
            start();
            recordContainerRef.current?.focus();
        }, 30);
    }, [start, stop]);

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
        setOpen(false);
    }, [onChange, shortcuts]);

    /**
     * 重置为默认值。
     */
    const resetToDefault = React.useCallback(() => {
        setShortcuts(parseShortcutList(defaultValue));
    }, [defaultValue]);

    /**
     * 清空全部按键。
     */
    const clearAll = React.useCallback(() => {
        setShortcuts([]);
    }, []);

    // 打开弹窗时自动激活录制监听
    React.useEffect(() => {
        if (open) {
            setShortcuts(parseShortcutList(value));
            setIsListening(true);
            start();
            // 聚焦录制容器
            setTimeout(() => {
                recordContainerRef.current?.focus();
            }, 50);
        } else {
            setIsListening(false);
            stop();
        }
    }, [open, start, stop, value]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button ref={triggerRef} className="hidden" aria-hidden="true" tabIndex={-1}>Open</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>{dialogTitle}</span>
                        <span className="text-sm font-normal text-muted-foreground">({title})</span>
                    </DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* 录制捕获面板 */}
                    <div
                        ref={recordContainerRef}
                        tabIndex={0}
                        onFocus={() => {
                            setIsListening(true);
                            start();
                        }}
                        onBlur={() => {
                            setIsListening(false);
                            stop();
                        }}
                        className={`relative group rounded-xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer outline-none ${
                            isListening
                                ? 'border-primary/60 bg-primary/5 shadow-inner'
                                : 'border-dashed border-border/80 hover:border-primary/40 bg-muted/20'
                        }`}
                    >
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {isListening ? (
                                <span className="flex items-center gap-1.5 text-primary animate-pulse">
                                    <Radio className="w-3.5 h-3.5" />
                                    {listeningPrompt}
                                </span>
                            ) : (
                                <span>点击此处激活按键录制</span>
                            )}
                        </div>

                        {/* 录制实时展示 */}
                        <div className="min-h-[36px] flex items-center justify-center">
                            {recordedShortcut ? (
                                <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100">
                                    {recordedShortcut.split('+').map((k, idx) => (
                                        <React.Fragment key={idx}>
                                            {idx > 0 && <span className="text-xs text-muted-foreground font-semibold">+</span>}
                                            <KeyCap label={k} className="h-8 min-w-[32px] px-2 text-sm shadow-md" />
                                        </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground/60 italic select-none">
                                    等待按键输入...（可随时直接按下新按键）
                                </span>
                            )}
                        </div>

                        {recordedShortcut && (
                            <div className="flex items-center gap-2 mt-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRerecord}
                                    className="h-7 text-xs gap-1"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    重新录制
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="default"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        appendRecordedShortcut();
                                    }}
                                    className="h-7 text-xs gap-1 shadow-sm"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {addRecordedLabel}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 当前绑定的快捷键列表 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{currentShortcutsLabel}</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5"
                                    onClick={clearAll}
                                >
                                    {clearAllLabel}
                                </Button>
                                <span className="text-border">|</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-1.5 gap-1"
                                    onClick={resetToDefault}
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    {resetDefaultLabel}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 min-h-[72px] flex flex-wrap gap-2 items-center content-start">
                            {shortcuts.length === 0 ? (
                                <div className="w-full text-center text-xs text-muted-foreground/60 py-2">
                                    {emptyShortcutsLabel}
                                </div>
                            ) : (
                                shortcuts.map((shortcut) => (
                                    <div
                                        key={shortcut}
                                        className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md border border-border/70 bg-background shadow-xs text-xs font-mono"
                                    >
                                        <div className="flex items-center gap-1">
                                            {shortcut.split('+').map((k, idx) => (
                                                <React.Fragment key={idx}>
                                                    {idx > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
                                                    <span className="font-semibold text-foreground">{formatKeySymbol(k)}</span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            className="ml-1 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            title={removeShortcutLabel}
                                            onClick={() => removeShortcut(shortcut)}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        取消
                    </Button>
                    <Button type="button" onClick={submitChanges}>
                        {saveChangesLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface ShortcutItemConfig {
    key: ShortcutKey;
    title: string;
    description: string;
}

interface ShortcutGroupConfig {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    items: ShortcutItemConfig[];
}

/**
 * 快捷键设置页面：展示全部动作并支持自动保存。
 */
const ShortcutSetting = () => {
    const { t } = useI18nTranslation('settings');
    const [searchQuery, setSearchQuery] = React.useState('');

    const { data: shortcutValues } = useSWR<ShortcutSettingDetailVO>(
        'settings/shortcuts/detail',
        settingsApi.getShortcuts,
    );

    const form = useForm<ShortcutFormValues>();

    const { control } = form;
    const { ready, status: autoSaveStatus, error: autoSaveError, initialize, flush } = useAutoSaveSettingsForm<ShortcutFormValues>({
        form,
        onSave: async (values) => {
            await settingsApi.saveShortcuts(values);
        },
    });

    React.useEffect(() => {
        if (!shortcutValues) {
            return;
        }
        initialize(shortcutValues);
    }, [initialize, shortcutValues]);

    // 快捷键 4 大模块分组定义
    const groups: ShortcutGroupConfig[] = React.useMemo(() => [
        {
            id: 'playback',
            title: t('shortcut.groups.playback'),
            description: t('shortcut.groups.playbackDesc'),
            icon: PlayCircle,
            items: [
                { key: 'playPause', title: t('shortcut.items.playPause.title'), description: t('shortcut.items.playPause.description') },
                { key: 'previousSentence', title: t('shortcut.items.previousSentence.title'), description: t('shortcut.items.previousSentence.description') },
                { key: 'nextSentence', title: t('shortcut.items.nextSentence.title'), description: t('shortcut.items.nextSentence.description') },
                { key: 'repeatSentence', title: t('shortcut.items.repeatSentence.title'), description: t('shortcut.items.repeatSentence.description') },
                { key: 'repeatSingleSentence', title: t('shortcut.items.repeatSingleSentence.title'), description: t('shortcut.items.repeatSingleSentence.description') },
                { key: 'autoPause', title: t('shortcut.items.autoPause.title'), description: t('shortcut.items.autoPause.description') },
                { key: 'nextPlaybackRate', title: t('shortcut.items.nextPlaybackRate.title'), description: t('shortcut.items.nextPlaybackRate.description') },
            ],
        },
        {
            id: 'subtitles',
            title: t('shortcut.groups.subtitles'),
            description: t('shortcut.groups.subtitlesDesc'),
            icon: Subtitles,
            items: [
                { key: 'toggleEnglishDisplay', title: t('shortcut.items.toggleEnglishDisplay.title'), description: t('shortcut.items.toggleEnglishDisplay.description') },
                { key: 'toggleChineseDisplay', title: t('shortcut.items.toggleChineseDisplay.title'), description: t('shortcut.items.toggleChineseDisplay.description') },
                { key: 'toggleBilingualDisplay', title: t('shortcut.items.toggleBilingualDisplay.title'), description: t('shortcut.items.toggleBilingualDisplay.description') },
                { key: 'toggleWordLevelDisplay', title: t('shortcut.items.toggleWordLevelDisplay.title'), description: t('shortcut.items.toggleWordLevelDisplay.description') },
            ],
        },
        {
            id: 'timing',
            title: t('shortcut.groups.timing'),
            description: t('shortcut.groups.timingDesc'),
            icon: Clock,
            items: [
                { key: 'adjustBeginMinus', title: t('shortcut.items.adjustBeginMinus.title'), description: t('shortcut.items.adjustBeginMinus.description') },
                { key: 'adjustBeginPlus', title: t('shortcut.items.adjustBeginPlus.title'), description: t('shortcut.items.adjustBeginPlus.description') },
                { key: 'adjustEndMinus', title: t('shortcut.items.adjustEndMinus.title'), description: t('shortcut.items.adjustEndMinus.description') },
                { key: 'adjustEndPlus', title: t('shortcut.items.adjustEndPlus.title'), description: t('shortcut.items.adjustEndPlus.description') },
                { key: 'clearAdjust', title: t('shortcut.items.clearAdjust.title'), description: t('shortcut.items.clearAdjust.description') },
            ],
        },
        {
            id: 'tools',
            title: t('shortcut.groups.tools'),
            description: t('shortcut.groups.toolsDesc'),
            icon: Sparkles,
            items: [
                { key: 'aiChat', title: t('shortcut.items.aiChat.title'), description: t('shortcut.items.aiChat.description') },
                { key: 'addClip', title: t('shortcut.items.addClip.title'), description: t('shortcut.items.addClip.description') },
                { key: 'openControlPanel', title: t('shortcut.items.openControlPanel.title'), description: t('shortcut.items.openControlPanel.description') },
                { key: 'nextTheme', title: t('shortcut.items.nextTheme.title'), description: t('shortcut.items.nextTheme.description') },
            ],
        },
    ], [t]);

    // 过滤逻辑（支持按名称、描述或当前按键过滤）
    const filteredGroups = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return groups;
        }

        return groups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => {
                    const titleMatch = item.title.toLowerCase().includes(query);
                    const descMatch = item.description.toLowerCase().includes(query);
                    const keyValue = form.getValues(item.key) ?? '';
                    const keyMatch = keyValue.toLowerCase().includes(query);
                    return titleMatch || descMatch || keyMatch;
                }),
            }))
            .filter((group) => group.items.length > 0);
    }, [groups, searchQuery, form]);

    if (!ready) {
        return (
            <SettingsLoadingSkeleton
                title={t('shortcut.title')}
                description={t('shortcut.description')}
            />
        );
    }

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
                contentClassName="space-y-6"
            >
                {autoSaveStatus === 'error' && autoSaveError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {autoSaveError}
                    </div>
                )}

                {/* 搜索过滤条 */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('shortcut.searchPlaceholder')}
                        className="pl-9 bg-background/80 pr-8"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {filteredGroups.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        {t('shortcut.noMatches')}
                    </div>
                ) : (
                    <TooltipProvider delayDuration={200}>
                        {filteredGroups.map((group) => (
                            <SettingCard
                                key={group.id}
                                title={group.title}
                                description={group.description}
                                icon={group.icon}
                            >
                                <div className="divide-y divide-border/60">
                                    <Table>
                                        <TableBody>
                                            {group.items.map((item) => (
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
                                                            listeningPrompt={t('shortcut.listeningPrompt')}
                                                            clearAllLabel={t('shortcut.clearAll')}
                                                        />
                                                    )}
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </SettingCard>
                        ))}
                    </TooltipProvider>
                )}
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
    listeningPrompt,
    clearAllLabel,
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
    listeningPrompt: string;
    clearAllLabel: string;
}) => {
    const triggerRef = React.useRef<HTMLButtonElement>(null!);
    const isDefault = value === defaultValue;

    return (
        <TableRow className="group/row hover:bg-muted/40 transition-colors">
            <TableCell className="py-2.5 w-[38%]">
                <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{description}</div>
                </div>
            </TableCell>
            <TableCell className="py-2.5">
                <KeyBadge keys={value} />
            </TableCell>
            <TableCell className="py-2.5 w-24 text-right">
                <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => triggerRef.current?.click()}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>{editLabel}</p></TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-7 w-7 transition-opacity ${
                                    isDefault
                                        ? 'text-muted-foreground/30 hover:text-muted-foreground/60 cursor-default'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                disabled={isDefault}
                                onClick={() => onChange(defaultValue)}
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
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
                    listeningPrompt={listeningPrompt}
                    clearAllLabel={clearAllLabel}
                />
            </TableCell>
        </TableRow>
    );
};

export default ShortcutSetting;
type ShortcutKey = keyof ShortcutSettingSaveVO;
type ShortcutStoreKey = `shortcut.${ShortcutKey}`;

type ShortcutFormValues = ShortcutSettingSaveVO;
