'use client';

import * as React from 'react';
import { Button } from '@/fronted/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/fronted/components/ui/popover';
import useSWR from 'swr';
import { Tag } from '@/common/contracts/tag';
import { CornerDownLeft, Plus, Search, Tag as TagIcon, X } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { Dialog, DialogContent } from '@/fronted/components/ui/dialog';
import { Badge } from '@/fronted/components/ui/badge';
import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import { favouriteApi } from '@/fronted/features/favourite/favouriteApi';
import { useTranslation } from 'react-i18next';

export default function TagSelector() {
    const { t } = useTranslation('common');
    const playInfo = useFavouriteClip((state) => state.playInfo);
    const {
        data: clipTags,
        mutate: clipTagMutate
    } = useSWR(playInfo ? [apiPath('favorite-clips/query-clip-tags'), playInfo.video.key] : null, ([_, key]) => favouriteApi.queryClipTags(key), {
        fallbackData: []
    });

    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
    const [tagToRename, setTagToRename] = React.useState<Tag | null>(null);

    const handleSelectTag = async (tag: Tag) => {
        const key = playInfo?.video.key;
        if (!key) return;
        await favouriteApi.addClipTag({
            key: key,
            tagId: tag.id
        });
        await swrApiMutate('favorite-clips/query-clip-tags');
        await swrApiMutate('favorite-clips/search');
        setPopoverOpen(false);
    };

    const handleCreateTag = async (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        const newTag = await favouriteApi.addTag(trimmedName);
        const key = playInfo?.video.key;
        if (!key) return;
        await favouriteApi.addClipTag({
            key: key,
            tagId: newTag.id
        });
        await swrApiMutate('favorite-clips/query-clip-tags');
        await swrApiMutate('favorite-clips/search');
        setPopoverOpen(false);
    };

    const handleRenameTag = async (id: number, newName: string) => {
        await favouriteApi.updateTag({ id, name: newName });
        await swrApiMutate('favorite-clips/query-clip-tags');
        await clipTagMutate();
        setRenameDialogOpen(false);
    };

    return (
        <div className={cn('w-full flex flex-wrap items-center gap-1.5 py-1')}>
            {clipTags.map((tag) => (
                <Badge
                    key={tag.id}
                    variant="secondary"
                    className={cn(
                        'group/tag relative flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-lg text-xs font-normal bg-muted/70 hover:bg-muted text-muted-foreground transition-colors'
                    )}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setTagToRename(tag);
                        setRenameDialogOpen(true);
                    }}
                >
                    <span className="truncate max-w-[120px]">{tag.name}</span>
                    <button
                        type="button"
                        className="h-3.5 w-3.5 inline-flex items-center justify-center p-0 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-background/80 transition-colors"
                        onClick={async (e) => {
                            e.stopPropagation();
                            const key = playInfo?.video.key;
                            if (!key) return;
                            await favouriteApi.deleteClipTag({
                                key: key,
                                tagId: tag.id
                            });
                            await clipTagMutate();
                            await swrApiMutate('favorite-clips/query-clip-tags');
                            await swrApiMutate('favorite-clips/search');
                        }}
                    >
                        <X className="h-2.5 w-2.5" />
                    </button>
                </Badge>
            ))}

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground/70 hover:text-foreground rounded-md gap-1 hover:bg-muted/50 transition-colors"
                    >
                        <Plus className="h-3 w-3" />
                        {t('addTag')}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[240px] p-0 shadow-lg border border-border bg-popover rounded-xl overflow-hidden z-50"
                    align="start"
                    sideOffset={6}
                >
                    <TagPickerList
                        onSelect={handleSelectTag}
                        onCreate={handleCreateTag}
                        clipTags={clipTags}
                    />
                </PopoverContent>
            </Popover>

            {/* 重命名标签对话框 */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-[360px] rounded-xl p-5">
                    <RenameTagForm
                        tag={tagToRename}
                        onRename={handleRenameTag}
                        onClose={() => setRenameDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TagPickerList({
    onSelect,
    onCreate,
    clipTags
}: {
    onSelect: (tag: Tag) => void;
    onCreate: (name: string) => void;
    clipTags: Tag[];
}) {
    const { t } = useTranslation('common');
    const [inputValue, setInputValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    const { data: tags = [] } = useSWR(['api/tags', inputValue], () => favouriteApi.searchTags(inputValue), {
        fallbackData: []
    });

    const attachedTagIds = React.useMemo(() => new Set(clipTags.map((t) => t.id)), [clipTags]);
    const filteredTags = React.useMemo(
        () => (tags || []).filter((tag) => !attachedTagIds.has(tag.id)),
        [tags, attachedTagIds]
    );

    const trimmedInput = inputValue.trim();
    const exactMatchExists = (tags || []).some(
        (t) => t.name.toLowerCase() === trimmedInput.toLowerCase()
    );

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleCreate = () => {
        if (trimmedInput) {
            onCreate(trimmedInput);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredTags.length > 0) {
                const exact = filteredTags.find(
                    (t) => t.name.toLowerCase() === trimmedInput.toLowerCase()
                );
                if (exact) {
                    onSelect(exact);
                    return;
                }
            }
            if (trimmedInput && !exactMatchExists) {
                handleCreate();
            }
        }
    };

    return (
        <div className="flex flex-col w-full text-foreground text-xs">
            {/* 搜索框 */}
            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/60 bg-muted/20">
                <Search className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('searchTags')}
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none border-none p-0 focus:ring-0"
                />
                {inputValue && (
                    <button
                        type="button"
                        onClick={() => setInputValue('')}
                        className="text-muted-foreground/60 hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>

            {/* 标签列表区 */}
            <div className="max-h-[220px] overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
                {filteredTags.map((tag) => (
                    <button
                        key={tag.id}
                        type="button"
                        onClick={() => onSelect(tag)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-foreground hover:bg-muted/80 transition-colors group cursor-pointer"
                    >
                        <span className="flex items-center gap-1.5 truncate">
                            <TagIcon className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                            {tag.name}
                        </span>
                    </button>
                ))}

                {/* 没有标签时的空状态 */}
                {trimmedInput.length === 0 && filteredTags.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground/60 select-none">
                        {t('noTagsAvailable')}
                    </div>
                )}

                {/* 搜索无匹配但没有输入创建项 */}
                {trimmedInput.length > 0 && filteredTags.length === 0 && exactMatchExists && (
                    <div className="py-4 text-center text-xs text-muted-foreground/60 select-none">
                        {t('noResults')}
                    </div>
                )}
            </div>

            {/* 快速新建标签按钮 */}
            {trimmedInput.length > 0 && !exactMatchExists && (
                <div className="p-1 border-t border-border/50 bg-muted/10">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer font-medium"
                    >
                        <span className="truncate flex items-center gap-1.5">
                            <Plus className="h-3 w-3" />
                            {t('createTag', { name: trimmedInput })}
                        </span>
                        <kbd className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/80 shadow-2xs">
                            <CornerDownLeft className="h-2.5 w-2.5" />
                            Enter
                        </kbd>
                    </button>
                </div>
            )}
        </div>
    );
}

function RenameTagForm({
    tag,
    onRename,
    onClose
}: {
    tag: Tag | null;
    onRename: (id: number, newName: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation('common');
    const [newName, setNewName] = React.useState(tag?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (tag && newName.trim()) {
            onRename(tag.id, newName.trim());
        }
    };

    if (!tag) return null;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t('renameTag')}</h3>
            <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-background border border-border/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={t('newTagName')}
                autoFocus
                required
            />
            <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onClose} className="rounded-lg text-xs">
                    {t('cancel')}
                </Button>
                <Button type="submit" size="sm" className="rounded-lg text-xs">
                    {t('confirm')}
                </Button>
            </div>
        </form>
    );
}
