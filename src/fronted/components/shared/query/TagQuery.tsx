import { Tag as TagIcon, X } from 'lucide-react';
import React from 'react';
import { Tag } from '@/common/contracts/tag';
import useSWR from 'swr';
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
import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { useTranslation } from 'react-i18next';

const api = backendClient;
const TagQuery = ({
                    onUpdate
                  }: {
                    onUpdate?: (tags: Tag[], relation: 'and' | 'or', includeNoTag: boolean) => void;

                  }
) => {
  const [selectedTags, setSelectedTags] = React.useState<Tag[]>([]);
  const [relation, setRelation] = React.useState<'and' | 'or'>('and');
  const [includeNoTag, setIncludeNoTag] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const { t } = useTranslation('common');


  const handleSelectedUpdate = (tags: Tag[]) => {
    setSelectedTags(tags);
    onUpdate?.(tags, relation, includeNoTag);
    setPopoverOpen(false);
  };

  return (
    <div className={cn('flex-1 min-w-[200px] border border-border/80 rounded-xl flex items-center flex-wrap gap-1.5 px-2 py-1 min-h-9 relative')}>
      {includeNoTag && (
        <Badge
          key={'no-tag'}
          variant="secondary"
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-normal z-10'
          )}
        >
          {t('noTag')}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted/80 rounded-full"
            onClick={async () => {
              setIncludeNoTag(false);
              onUpdate?.(selectedTags, relation, false);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-normal z-10'
          )}
        >
          {tag.name}
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-muted/80 rounded-full"
            onClick={async () => {
              handleSelectedUpdate(selectedTags.filter((t) => t.id !== tag.id));
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground justify-start gap-1.5"
          >
            <TagIcon className="w-3.5 h-3.5" />
            {selectedTags.length === 0 && !includeNoTag && t('pickTags')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <StatusList
            onSelect={(tag) => {
              handleSelectedUpdate([...selectedTags, tag]);
            }}
            selectedTags={selectedTags}
            includeNoTag={includeNoTag}
            onIncludeNoTagChange={(includeNoTag) => {
              setIncludeNoTag(includeNoTag);
              onUpdate?.(selectedTags, relation, includeNoTag);
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center pl-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const nextRelation = relation === 'and' ? 'or' : 'and';
            setRelation(nextRelation);
            onUpdate?.(selectedTags, nextRelation, includeNoTag);
          }}
          className="h-6 px-2 text-[11px] font-medium rounded-lg text-muted-foreground hover:text-foreground"
        >
          {relation === 'and' ? 'AND (全部匹配)' : 'OR (任一匹配)'}
        </Button>
      </div>
    </div>
  );
};

function StatusList({
                      onSelect,
                      selectedTags,
                      includeNoTag,
                      onIncludeNoTagChange
                    }: {
  onSelect: (tag: Tag) => void;
  selectedTags: Tag[];
  includeNoTag: boolean;
  onIncludeNoTagChange: (includeNoTag: boolean) => void;
}) {
  const { t } = useTranslation('common');
  const [query, setQuery] = React.useState('');
  const { data: tags } = useSWR([apiPath('tag/search'), query], ([_, q]) => api.call('tag/search', q), {
    fallbackData: []
  });
  const filteredTags = tags.filter((tag) => !selectedTags.find((t) => t.id === tag.id));
  const [inputValue, setInputValue] = React.useState('');


  return (
    <Command>
      <CommandInput
        placeholder={t('searchTags')}
        value={inputValue}
        onValueChange={(value) => {
          setInputValue(value);
          setQuery(value);
        }}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center justify-center p-4">
            <span>{t('noResults')}</span>
          </div>
        </CommandEmpty>
        {!includeNoTag && (
          <CommandGroup>
            <CommandItem
              value="no-tag"
              onSelect={() => {
                onIncludeNoTagChange(true);
              }}
            >
              {t('noTag')}
            </CommandItem>
          </CommandGroup>
        )}
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
