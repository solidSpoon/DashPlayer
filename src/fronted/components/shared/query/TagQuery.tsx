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
    <div className={cn('w-full border rounded-lg flex flex-wrap gap-1 p-1 h-10 relative pr-20')}>
      {includeNoTag && (
        <Badge
          key={'no-tag'}
          variant="outline"
          className={cn(
            'flex p-1 pl-2 rounded-lg h-full z-10 bg-background'
          )}
        >
          {t('noTag')}
          <Button variant="ghost" size="icon" className="m-0.5 h-5 w-5"
                  onClick={async () => {
                    setIncludeNoTag(false);
                    onUpdate?.(selectedTags, relation, false);
                  }}
          >
            <X className={'h-3 w-3'} />
          </Button>
        </Badge>
      )}
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            'flex p-1 pl-2 rounded-lg h-full z-10 bg-background'
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
      <Button variant={'ghost'} size={'icon'}
              onClick={() => {
                setRelation(relation === 'and' ? 'or' : 'and');
                onUpdate?.(selectedTags, relation === 'and' ? 'or' : 'and', includeNoTag);
              }}
              className="absolute top-0 right-0 h-full z-10">
        {relation === 'and' ? 'AND' : 'OR'}
      </Button>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost"
                  size={'icon'}
                  className="w-full h-full absolute top-0 left-0 justify-start text-muted-foreground">
            {selectedTags.length === 0 && !includeNoTag && (<>
                <TagIcon className={'ml-2 mr-2 w-4 h-4'} />
                {t('pickTags')}
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
            includeNoTag={includeNoTag}
            onIncludeNoTagChange={(includeNoTag) => {
              setIncludeNoTag(includeNoTag);
              onUpdate?.(selectedTags, relation, includeNoTag);
            }}
          />
        </PopoverContent>
      </Popover>
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
