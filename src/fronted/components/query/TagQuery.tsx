import { Plus, Search, Tag as TagIcon, X } from 'lucide-react';
import { Input } from '@/fronted/components/ui/input';
import React from 'react';
import { Tag } from '@/backend/db/tables/tag';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import useSWR, { mutate } from 'swr';
import { cn } from '@/fronted/lib/utils';
import { Badge } from '@/fronted/components/ui/badge';
import { Button } from '@/fronted/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/fronted/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from '@/fronted/components/ui/command';
import { apiPath } from '@/fronted/lib/swr-util';

const api = window.electron;
const TagQuery = ({
                      onUpdate
                  }: {
                      onUpdate?: (tags: Tag[]) => void
                  }
) => {
    const [selectedTags, setSelectedTags] = React.useState<Tag[]>([]);

    const [popoverOpen, setPopoverOpen] = React.useState(false);


    const handleSelectedUpdate = (tags: Tag[]) => {
        setSelectedTags(tags);
        onUpdate?.(tags);
        setPopoverOpen(false);
    };

    return (
        <div className={cn('w-80 border rounded-lg flex flex-wrap gap-1 p-1 h-10 relative')}>
            {selectedTags.map((tag) => (
                <Badge
                    key={tag.id}
                    variant="outline"
                    className={cn(
                        'relative flex p-1 pl-2 rounded-lg h-full z-10 bg-background'
                    )}
                >
                    {tag.name}
                    <Button variant="ghost" size="icon" className="m-0.5 h-5 w-5"
                            onClick={async () => {
                                handleSelectedUpdate(selectedTags.filter((t) => t.id !== tag.id));
                            }}
                    >
                        <X className={'h-3 w-3'} />
                    </Button>
                </Badge>
            ))}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost"
                            size={'icon'}
                            className="w-full h-full absolute top-0 left-0 justify-start text-muted-foreground">
                        {selectedTags.length === 0 && (<>
                                <TagIcon className={'ml-2 mr-2 w-4 h-4'}/>
                                pick tags
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                    <StatusList
                        onSelect={(tag) => {
                            handleSelectedUpdate([...selectedTags, tag]);
                        }}
                        selectedTags={selectedTags}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
};

function StatusList({
                        onSelect,
                        selectedTags

                    }: {
    onSelect: (tag: Tag) => void;
    selectedTags: Tag[];
}) {
    const [query, setQuery] = React.useState('');
    const { data: tags } = useSWR([apiPath('tag/search'), query], ([_, q]) => api.call('tag/search', q), {
        fallbackData: []
    });
    const filteredTags = tags.filter((tag) => !selectedTags.find((t) => t.id === tag.id));
    const [inputValue, setInputValue] = React.useState('');


    return (
        <Command>
            <CommandInput
                placeholder="搜索标签..."
                value={inputValue}
                onValueChange={(value) => {
                    setInputValue(value);
                    setQuery(value);
                }}
            />
            <CommandList>
                <CommandEmpty>
                    <div className="flex flex-col items-center justify-center p-4">
                        <span>没有找到相关标签</span>
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

export default TagQuery;
