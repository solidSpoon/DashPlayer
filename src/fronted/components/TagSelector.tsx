'use client';

import * as React from 'react';
import { Button } from '@/fronted/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/fronted/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/fronted/components/ui/popover';
import useSWR from 'swr';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import { Plus, X } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { Dialog, DialogContent } from '@/fronted/components/ui/dialog';
import { Badge } from '@/fronted/components/ui/badge';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';

// 模拟API调用
const api = window.electron;
export default function TagSelector() {
    const playInfo = useFavouriteClip(state => state.playInfo);
    const {
        data: clipTags,
        mutate: clipTagMutate
    } = useSWR(playInfo ? [apiPath('favorite-clips/query-clip-tags'), playInfo.video.key] : null, ([_, key]) => api.call('favorite-clips/query-clip-tags', key), {
        fallbackData: []
    });

    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
    const [tagToRename, setTagToRename] = React.useState<Tag | null>(null);

    const handleSelectTag = async (tag: Tag) => {
        const key = playInfo?.video.key;
        if (!key) return;
        await api.call('favorite-clips/add-clip-tag', {
            key: key,
            tagId: tag.id
        });
        await swrApiMutate('favorite-clips/query-clip-tags');
        await swrApiMutate('favorite-clips/search');

        setPopoverOpen(false);
    };

    const handleCreateTag = async (name: string) => {
        const newTag = await api.call('tag/add', name);
        const key = playInfo?.video.key;
        if (!key) return;
        await api.call('favorite-clips/add-clip-tag', {
            key: key,
            tagId: newTag.id
        });
        await swrApiMutate('favorite-clips/query-clip-tags'); // 重新获取标签数据
        await swrApiMutate('favorite-clips/search');
        setPopoverOpen(false);
    };

    const handleRenameTag = async (id: number, newName: string) => {
        await api.call('tag/update', { id, name: newName });
        await swrApiMutate('favorite-clips/query-clip-tags'); // 重新获取标签数据
        await clipTagMutate();
        setRenameDialogOpen(false);
    };

    return (
        <div className={cn('w-full border rounded-lg flex flex-wrap gap-2 p-2')}>
            {clipTags.map((tag) => (
                <Badge
                    key={tag.id}
                    variant="outline"
                    className={cn(
                        'relative flex gap-1 p-1 pl-2 rounded-lg'
                    )}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setTagToRename(tag);
                        setRenameDialogOpen(true);
                    }}
                >
                    {tag.name}
                    <Button variant="ghost" size="icon" className="m-0.5 h-5 w-5"
                            onClick={async () => {
                                const key = playInfo?.video.key;
                                if (!key) return;
                                await api.call('favorite-clips/delete-clip-tag', {
                                    key: key,
                                    tagId: tag.id
                                });
                                await clipTagMutate();
                                await swrApiMutate('favorite-clips/query-clip-tags');
                                await swrApiMutate('favorite-clips/search');
                            }}
                    >
                        <X />
                    </Button>
                </Badge>
            ))}

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline"
                            size={'sm'}
                            className="w-fit">
                        <Plus />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                    <StatusList
                        onSelect={handleSelectTag}
                        onCreate={handleCreateTag}
                        clipTags={clipTags}
                    />
                </PopoverContent>
            </Popover>

            {/* 重命名标签对话框 */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
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

function StatusList({
                        onSelect,
                        onCreate,
                        clipTags
                    }: {
    onSelect: (tag: Tag) => void;
    onCreate: (name: string) => void;
    clipTags: Tag[];
}) {
    const [query, setQuery] = React.useState('');
    const { data: tags, error } = useSWR(['api/tags', query], () => api.call('tag/search', query), {
        fallbackData: []
    });
    const filteredTags = tags.filter((tag) => !clipTags.find((t) => t.id === tag.id));
    const [inputValue, setInputValue] = React.useState('');

    const handleCreate = () => {
        if (inputValue.trim()) {
            onCreate(inputValue.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && tags.length === 0 && inputValue.trim()) {
            e.preventDefault(); // 防止默认的表单提交行为
            handleCreate();
        }
    };


    return (
        <Command>
            <CommandInput
                placeholder="搜索标签..."
                value={inputValue}
                onValueChange={(value) => {
                    setInputValue(value);
                    setQuery(value);
                }}
                onKeyDown={handleKeyDown} // 添加键盘事件处理
            />
            <CommandList>
                <CommandEmpty>
                    <div className="flex flex-col items-center justify-center p-4">
                        <span>没有找到相关标签</span>
                        <Button
                            variant="link"
                            onClick={handleCreate}
                            className="mt-2 text-blue-600"
                        >
                            创建标签 &quot;{inputValue}&quot;
                        </Button>
                    </div>
                </CommandEmpty>
                {filteredTags.length > 0 && (
                    <CommandGroup>
                        {filteredTags.map((tag) => (
                            <CommandItem
                                key={tag.id}
                                value={tag.name}
                                onSelect={() => onSelect(tag)}
                            >
                                {tag.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
                {filteredTags.length === 0 && tags.length > 0 && (
                    <CommandGroup>
                        {tags.map((tag) => (
                            <CommandItem
                                key={tag.id}
                                value={tag.name}
                                disabled
                                // onSelect={() => onSelect(tag)}
                            >
                                {tag.name}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </Command>
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
            <h3 className="text-lg font-semibold">重命名标签</h3>
            <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border p-2 rounded"
                placeholder="新的标签名称"
                required
            />
            <div className="flex justify-end space-x-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                    取消
                </Button>
                <Button type="submit">
                    确认
                </Button>
            </div>
        </form>
    );
}
