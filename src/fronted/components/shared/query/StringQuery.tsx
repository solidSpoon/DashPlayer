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
        <div className="relative md:grow-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder={t('search')}
                className="w-full h-9 rounded-xl bg-background pl-9 pr-14 text-sm border-border/80 md:w-[200px] lg:w-[280px]"
                value={query}
                onChange={(e) => setQuery?.(e.target.value)}
            />
            <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                    setKeywordRange(keywordRange === 'clip' ? 'context' : 'clip');
                    onKeywordRangeChange?.(keywordRange === 'clip' ? 'context' : 'clip');
                }}
                className="absolute right-1 top-1 h-7 px-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground"
            >
                {keywordRange === 'clip' ? t('clip') : t('context')}
            </Button>
        </div>
    );
};

export default StringQuery;
