import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/fronted/lib/utils';
import useSWR from 'swr';
import { LoaderPinwheel } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/fronted/components/ui/hover-card';
import FavouritePlayer from './components/FavouritePlayer';
import FavouriteItem from './components/FavouriteItem';
import DatePickerWithRange from '@/fronted/components/shared/query/DatePickerWithRange';
import StringQuery from '@/fronted/components/shared/query/StringQuery';
import TagQuery from '@/fronted/components/shared/query/TagQuery';
import { DateRange } from 'react-day-picker';
import { Tag } from '@/backend/infrastructure/db/tables/tag';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import { Virtuoso } from 'react-virtuoso';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import toast from 'react-hot-toast';
import { Button } from '@/fronted/components/ui/button';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const api = backendClient;

const Loader = () => {
    const { data: unfinishedLength } = useSWR(apiPath('favorite-clips/task-info'), () => api.call('favorite-clips/task-info'), {
        fallbackData: 0
    });
    const has = unfinishedLength > 0;

    useEffect(() => {
        const timer = setInterval(() => {
            swrApiMutate(apiPath('favorite-clips/task-info')).then();
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    });
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
                {`${unfinishedLength} tasks in progress`}
            </HoverCardContent>
        </HoverCard>
    );
};


const Favorite = () => {
    const { t } = useI18nTranslation('pages');
    const virtuosoRef = useRef<any>(null);
    const [keyword, setKeyword] = useState('');
    const [tagRelation, setTagRelation] = useState<'and' | 'or'>('and');
    const [tags, setTags] = useState<Tag[]>([]);
    const [date, setDate] = useState<DateRange>({ from: undefined, to: undefined });
    const [includeNoTag, setIncludeNoTag] = useState(false);
    const [keywordRange, setKeywordRange] = useState<'clip' | 'context'>('clip');
    const { data } = useSWR([apiPath('favorite-clips/search'), keyword, tags, date, tagRelation, includeNoTag, keywordRange], () => {
        // 将 searchQuery 传递给接口
        return api.call('favorite-clips/search', {
            keyword,
            keywordRange,
            tags: tags.map((tag) => tag.id),
            tagsRelation: tagRelation,
            date,
            includeNoTag
        });
    },{
        fallbackData: []
    });

    const playInfo = useFavouriteClip((state) => state.playInfo);

    /**
     * 从本地 Saved Moments 文件夹重建索引。
     *
     * 行为说明：
     * - 以本地文件夹中的 metadata 为准回灌数据库。
     * - 完成后刷新当前列表数据。
     */
    const recoverSavedMoments = async (): Promise<void> => {
        await toast.promise(
            (async () => {
                await api.call('favorite-clips/sync-from-oss');
                await swrApiMutate('favorite-clips/search');
            })(),
            {
                loading: t('savedMoments.recover.loading'),
                success: t('savedMoments.recover.success'),
                error: t('savedMoments.recover.error'),
            }
        );
    };

    // 当当前播放的视频变化时，自动滚动到该视频位置
    useEffect(() => {
        if (playInfo && data.length > 0) {
            const currentIndex = data.findIndex((item: any) => item.key === playInfo.video.key);
            if (currentIndex !== -1 && virtuosoRef.current) {
                // 滚动到当前视频，确保它在视图中可见
                virtuosoRef.current.scrollToIndex({
                    index: currentIndex,
                    behavior: 'smooth',
                    align: 'center'
                });
            }
        }
    }, [playInfo, data]);

    return (
        <div
            className={cn(
                'w-full h-full flex flex-col overflow-hidden select-none bg-background px-6 py-4 gap-4 text-foreground'
            )}
        >
            <PageHeader
                title={t('savedMoments.title')}
                description={t('savedMoments.description')}
                rightSlot={<Loader />}
            />
            <div className="w-full p-2 flex gap-2">
                <StringQuery
                    query={keyword}
                    setQuery={setKeyword}
                    onKeywordRangeChange={setKeywordRange}
                />
                <DatePickerWithRange dateRange={date} onDateRangeChange={setDate} />
                <TagQuery onUpdate={(t, r, includeNoTag) => {
                    setTags(t);
                    setTagRelation(r);
                    setIncludeNoTag(includeNoTag);
                }} />
            </div>
            <div className="flex-1 h-0 pl-10 pb-6 pr-16 grid gap-8"
                 style={{
                     gridTemplateColumns: '55% 45%',
                     gridTemplateRows: '100%'
                 }}
            >
                {data.length === 0 ? (
                    <div className="max-w-3xl rounded-xl border border-dashed border-border p-8 flex flex-col gap-4 items-start justify-center">
                        <h3 className="text-xl font-semibold">{t('savedMoments.empty.title')}</h3>
                        <p className="text-sm text-muted-foreground leading-6">
                            {t('savedMoments.empty.guideAdd')}
                        </p>
                        <p className="text-sm text-muted-foreground leading-6">
                            {t('savedMoments.empty.guideRecover')}
                        </p>
                        <Button type="button" variant="outline" onClick={recoverSavedMoments}>
                            {t('savedMoments.recover.button')}
                        </Button>
                    </div>
                ) : (
                    <Virtuoso
                        ref={virtuosoRef}
                        className={cn('max-w-3xl scrollbar-none')}
                        data={data}
                        itemContent={(_index, item) => <FavouriteItem item={item} />}
                    />
                )}
                <FavouritePlayer />
            </div>
        </div>
    );
};

export default Favorite;
