import { Search } from 'lucide-react';
import { Input } from '@/fronted/components/ui/input';
import React from 'react';

const StringQuery = ({ query, setQuery }: {
                         query?: string,
                         setQuery?: (query: string) => void
                     }
) => {
    return (
        <div className="relative md:grow-0 ">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                value={query}
                onChange={(e) => setQuery?.(e.target.value)}
            />
        </div>
    );
};

export default StringQuery;
