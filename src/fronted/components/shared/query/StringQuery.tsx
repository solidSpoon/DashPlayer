import { Search } from 'lucide-react';
import { Input } from '@/fronted/components/ui/input';
import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import { useTranslation } from 'react-i18next';

const StringQuery = ({
                         query, setQuery, onKeywordRangeChange
                     }: {
                         query?: string,
                         setQuery?: (query: string) => void,
                         onKeywordRangeChange?: (keywordRange: 'clip' | 'context') => void
                     }
) => {
    const [keywordRange, setKeywordRange] = React.useState<'clip' | 'context'>('clip');
    const { t } = useTranslation('common');
    return (
        <div className="relative md:grow-0 ">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder={t('search')}
                className="w-full rounded-lg bg-background pl-8 pr-10 md:w-[200px] lg:w-[336px]"
                value={query}
                onChange={(e) => setQuery?.(e.target.value)}
            />
            <Button variant={'ghost'}
                    onClick={() => {
                        setKeywordRange(keywordRange === 'clip' ? 'context' : 'clip');
                        onKeywordRangeChange?.(keywordRange === 'clip' ? 'context' : 'clip');
                    }}
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8">
                {keywordRange === 'clip' ? t('clip') : t('context')}
            </Button>
        </div>
    );
};

export default StringQuery;
