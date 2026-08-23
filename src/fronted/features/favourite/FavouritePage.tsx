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
import { Tag } from '@/common/contracts/tag';
import { apiPath, swrApiMutate } from '@/fronted/lib/swr-util';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { favouriteApi } from '@/fronted/features/favourite/favouriteApi';
import toast from 'react-hot-toast';
import { Button } from '@/fronted/components/ui/button';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const Loader = () => {
    const { data: unfinishedLength } = useSWR(apiPath('favorite-clips/task-info'), favouriteApi.getTaskInfo, {
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
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [keyword, setKeyword] = useState('');
    const [tagRelation, setTagRelation] = useState<'and' | 'or'>('and');
    const [tags, setTags] = useState<Tag[]>([]);
    const [date, setDate] = useState<DateRange>({ from: undefined, to: undefined });
    const [includeNoTag, setIncludeNoTag] = useState(false);
    const [keywordRange, setKeywordRange] = useState<'clip' | 'context'>('clip');
    const { data } = useSWR([apiPath('favorite-clips/search'), keyword, tags, date, tagRelation, includeNoTag, keywordRange], () => {
        // 将 searchQuery 传递给接口
        return favouriteApi.search({
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
                await favouriteApi.syncFromOss();
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
            const currentIndex = data.findIndex((item) => item.key === playInfo.video.key);
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
        <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
            {/* 顶栏标题区：统一排版 */}
            <div className="px-6 pt-5 pb-2">
                <PageHeader
                    title={t('savedMoments.title')}
                    description={t('savedMoments.description')}
                    rightSlot={<Loader />}
                />
            </div>

            <div className="flex-1 min-h-0 flex flex-col px-6 pb-5 pt-1 gap-3.5 overflow-hidden">
                {/* 顶部搜索与筛选控制条 */}
                <div className="w-full flex flex-wrap items-center gap-2.5">
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

                {/* 内容主体：左侧列表 + 右侧播放器与金句 */}
                <div
                    className="flex-1 min-h-0 grid gap-6"
                    style={{
                        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(360px, 0.8fr)',
                        gridTemplateRows: '100%'
                    }}
                >
                    {data.length === 0 ? (
                        <div className="w-full h-full flex flex-col gap-3 items-center justify-center text-center text-muted-foreground/60">
                            <h3 className="text-base font-medium text-foreground/80">{t('savedMoments.empty.title')}</h3>
                            <p className="text-xs max-w-sm leading-5">
                                {t('savedMoments.empty.guideAdd')}
                            </p>
                            <Button type="button" variant="outline" size="sm" className="rounded-lg mt-2" onClick={recoverSavedMoments}>
                                {t('savedMoments.recover.button')}
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full h-full min-h-0 overflow-hidden pr-2 border-r border-border/40">
                            <Virtuoso
                                ref={virtuosoRef}
                                className="w-full h-full scrollbar-none"
                                data={data}
                                itemContent={(_index, item) => <FavouriteItem item={item} />}
                            />
                        </div>
                    )}
                    <div className="w-full h-full min-h-0 overflow-y-auto pl-1 pr-1 scrollbar-none">
                        <FavouritePlayer />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Favorite;
