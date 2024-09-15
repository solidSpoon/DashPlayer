// TagSelector.tsx
import React, { useState, useEffect } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/fronted/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/fronted/components/ui/popover';
import { Button } from '@/fronted/components/ui/button';
import { PlusIcon, PencilIcon } from 'lucide-react';

interface Tag {
    id: string;
    name: string;
}

const TagSelector: React.FC = () => {
    const [tags, setTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState<null | Tag>(null);
    const [renameValue, setRenameValue] = useState('');

    // 模拟获取标签数据
    useEffect(() => {
        // 假设这是从接口获取的标签
        fetch('/api/tags') // 这里使用假的地址
            .then(response => response.json())
            .then(data => setTags(data))
            .catch(() => setTags([]));
    }, []);

    // 搜索标签
    const handleSearch = (query: string) => {
        // 实现搜索逻辑，可以根据需要调整
        return tags.filter(tag => tag.name.toLowerCase().includes(query.toLowerCase()));
    };

    // 添加标签
    const handleSelectTag = (tag: Tag) => {
        if (!selectedTags.find(t => t.id === tag.id)) {
            setSelectedTags([...selectedTags, tag]);
        }
        setIsPopoverOpen(false);
    };

    // 创建新标签
    const handleCreateTag = (name: string) => {
        const newTag: Tag = { id: Date.now().toString(), name };
        // 这里可以调用接口创建标签，暂时直接添加
        setTags([...tags, newTag]);
        setSelectedTags([...selectedTags, newTag]);
        setIsPopoverOpen(false);
    };

    // 重命名标签
    const handleRenameTag = () => {
        if (isRenaming) {
            setTags(tags.map(tag => tag.id === isRenaming.id ? { ...tag, name: renameValue } : tag));
            setSelectedTags(selectedTags.map(tag => tag.id === isRenaming.id ? { ...tag, name: renameValue } : tag));
            setIsRenaming(null);
            setRenameValue('');
        }
    };

    // 右键菜单事件
    const handleContextMenu = (e: React.MouseEvent, tag: Tag) => {
        e.preventDefault();
        const newName = prompt('重命名标签', tag.name);
        if (newName && newName.trim() !== '') {
            setTags(tags.map(t => t.id === tag.id ? { ...t, name: newName } : t));
            setSelectedTags(selectedTags.map(t => t.id === tag.id ? { ...t, name: newName } : t));
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
                <div
                    key={tag.id}
                    className="flex items-center px-2 py-1 bg-gray-200 rounded-full cursor-pointer"
                    onContextMenu={(e) => handleContextMenu(e, tag)}
                >
                    {tag.name}
                    <PencilIcon
                        className="ml-1 h-4 w-4"
                        onClick={() => {
                            setIsRenaming(tag);
                            setRenameValue(tag.name);
                        }}
                    />
                </div>
            ))}

            {/* 添加标签按钮 */}
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                        <PlusIcon className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <Command>
                        <CommandInput placeholder="搜索标签..." />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-4">未找到标签，可以创建一个新的标签。</div>
                            </CommandEmpty>
                            <CommandGroup heading="标签">
                                {handleSearch('').map(tag => (
                                    <CommandItem key={tag.id} onSelect={() => handleSelectTag(tag)}>
                                        {tag.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup heading="创建标签">
                                <CommandItem onSelect={() => {
                                    const newTagName = prompt('输入新标签名称');
                                    if (newTagName && newTagName.trim() !== '') {
                                        handleCreateTag(newTagName);
                                    }
                                }}>
                                    创建新标签
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* 重命名弹窗 */}
            {isRenaming && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white p-4 rounded shadow">
                        <h3 className="text-lg mb-2">重命名标签</h3>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="border p-2 rounded w-full"
                        />
                        <div className="flex justify-end mt-4">
                            <Button onClick={() => setIsRenaming(null)} variant="ghost">取消</Button>
                            <Button onClick={handleRenameTag} className="ml-2">确认</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TagSelector;
