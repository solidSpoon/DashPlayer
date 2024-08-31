import React from 'react';
import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import useSWR from 'swr';
import UrlUtil from '@/common/utils/UrlUtil';

const api = window.electron;
const Favorite = () => {
    const { data } = useSWR('favorite', () => {
        return api.call('favorite-clips/search', '');
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
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Add subtitles to your videos using OpenAI's Whisper Large model
                </h2>
                <Separator orientation="horizontal" className="px-0" />
            </div>

            <div className="flex-1 h-0 pl-10 pb-6 pr-16 flex flex-col gap-8 overflow-y-scroll scrollbar-none"
                 style={{
                     gridTemplateColumns: '40% 60%',
                     gridTemplateRows: '100%'
                 }}
            >
                {data?.map((item) => (
                    <div key={item.key}
                         className={cn('flex max-w-3xl items-center gap-4 rounded-xl')}>
                        <div className="flex flex-col w-44 gap-1 h-full overflow-hidden p-2 select-text">
                            <video
                                src={UrlUtil.file(item.clipPath)}
                                style={{
                                    aspectRatio: '16/9'
                                }}
                                className="w-full self-start object-cover rounded-lg"
                                onMouseEnter={e => e.currentTarget.play()}
                                onMouseLeave={e => e.currentTarget.pause()}
                                loop
                            >
                                <source src={item.clipPath} type="video/mp4" />
                            </video>
                            {/* <div className={cn('text-xs text-secondary-foreground')}>{new Date(item.created_at).toLocaleString()}</div> */}
                        </div>
                        <div className="w-0 flex-1 flex flex-col gap h-full overflow-hidden select-text">
                            <div className={cn('text-base')}>{item.srt_clip}</div>
                            <div className={cn('text-sm text-muted-foreground')}>{new Date(item.created_at).toLocaleString() +"     "+item.video_name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Favorite;
