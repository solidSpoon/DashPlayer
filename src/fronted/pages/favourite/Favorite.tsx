import React, { useState } from 'react';
import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import useSWR from 'swr';
import { LoaderPinwheel } from 'lucide-react';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/fronted/components/ui/hover-card';
import FavouritePlayer from '@/fronted/pages/favourite/FavouritePlayer';
import FavouriteItem from '@/fronted/pages/favourite/FavouriteItem';
import DatePickerWithRange from '@/fronted/components/query/DatePickerWithRange';
import StringQuery from '@/fronted/components/query/StringQuery';
import TagQuery from '@/fronted/components/query/TagQuery';
import { DateRange } from 'react-day-picker';
import { Tag } from '@/backend/db/tables/tag';

const api = window.electron;


const Loader = () => {
    const unfinishedTasks = useFavouriteClip(state => state.unfinishedTasks);
    const has = unfinishedTasks.length > 0;
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <LoaderPinwheel
                    className={cn('mb-1.5 rounded-full p-1 bg-primary',
                        has ? 'animate-spin text-primary-foreground' : 'hidden'
                    )}
                />
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
                {`${unfinishedTasks.length} tasks in progress`}
            </HoverCardContent>
        </HoverCard>
    );
};


const Favorite = () => {
    const [keyword, setKeyword] = useState('');
    const [tags, setTags] = useState<Tag[]>([]);
    const [date, setDate] = useState<DateRange>({ from: null, to: null });
    const { data } = useSWR(['favorite', keyword, tags, date], (apiPath) => {
        // 将 searchQuery 传递给接口
        return api.call('favorite-clips/search', {
            keyword,
            tags: tags.map((tag) => tag.id),
            date
        });
    });


    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background p-6 pt-12 gap-4 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Favorite
                </h1>
                <div className="flex items-center gap-4">
                    <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                        Add subtitles to your videos using OpenAI's Whisper Large model
                    </h2>
                    <Loader />
                </div>

                <Separator orientation="horizontal" className="px-0" />
            </div>
            <div className="w-full p-2 flex gap-2">
                <StringQuery
                    query={keyword}
                    setQuery={setKeyword}
                />
                <TagQuery onUpdate={setTags}/>
                <DatePickerWithRange onDateRangeChange={setDate} />
            </div>
            <div className="flex-1 h-0 pl-10 pb-6 pr-16 grid gap-8"
                 style={{
                     gridTemplateColumns: '55% 45%',
                     gridTemplateRows: '100%'
                 }}
            >
                <div className={'max-w-3xl flex flex-col gap-8 overflow-y-scroll scrollbar-none'}>

                    {data?.map((item) => (
                        <FavouriteItem item={item} />
                    ))}
                </div>
                <FavouritePlayer />
            </div>
        </div>
    );
};

export default Favorite;
