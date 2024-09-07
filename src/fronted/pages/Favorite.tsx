import React, { useState } from 'react';
import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/Separtor';
import useSWR from 'swr';
import UrlUtil from '@/common/utils/UrlUtil';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import ReactPlayer from 'react-player';
import { OssObject } from '@/common/types/OssObject';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import { Search } from 'lucide-react';
import { Input } from '@/fronted/components/ui/input';

const api = window.electron;

interface PlayInfo {
    video: OssObject;
    /**
     * 从 0 开始的时间
     */
    time: number;
    timeUpdated: number;
}

const Favorite = () => {
    const [searchQuery, setSearchQuery] = useState(''); // 新增状态来管理搜索输入
    const { data } = useSWR(['favorite', searchQuery], () => {
        // 将 searchQuery 传递给接口
        return api.call('favorite-clips/search', searchQuery);
    });
    const [play, setPlay] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
    const playerRef = React.useRef<ReactPlayer>(null);
    const lastSeekTime = React.useRef<PlayInfo>();
    const lastCurrentLine = React.useRef<SrtLine>();


    if (lastSeekTime.current !== playInfo) {
        lastSeekTime.current = playInfo;
        setTimeout(() => {
            if (playerRef.current !== null) {
                playerRef.current.seekTo(playInfo?.time);
            }
        }, 100);
    }
    const isCurrentLine = (line: SrtLine) => {
        const valid = Date.now() - (playInfo?.timeUpdated ?? 0) > 500;
        const ct = valid ? currentTime : (playInfo?.time ?? 0);
        const cs = ct + playInfo?.video.start_time;
        return line.start <= cs && line.end > cs;
    };

    const isCurrentVideo = (video: OssObject) => {
        return playInfo?.video.key === video.key;
    };

    data?.map((item) => {
        console.log(SrtUtil.parseSrt(item.srt_str));
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

            <div className="flex-1 h-0 pl-10 pb-6 pr-16 grid gap-8"
                 style={{
                     gridTemplateColumns: '55% 45%',
                     gridTemplateRows: '100%'
                 }}
            >
                <div className={'max-w-3xl flex flex-col gap-8 overflow-y-scroll scrollbar-none'}>
                    <div className="sticky top-0 w-full p-2 bg-background">
                        <div className=" ml-auto relative md:grow-0 ">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search..."
                                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {data?.map((item) => (
                        <div key={item.key}
                             className={cn('flex max-w-3xl items-center gap-4 rounded-xl')}>
                            <div className="flex flex-col w-44 gap-1 h-full overflow-hidden p-2 select-text">
                                <img
                                    className={cn('w-full rounded-lg')}
                                    src={UrlUtil.dp(item.thumbnailPath)}
                                    style={{
                                        aspectRatio: '16/9'
                                    }}
                                    alt={''} />
                                {/* <div className={cn('text-xs text-secondary-foreground')}>{new Date(item.created_at).toLocaleString()}</div> */}
                            </div>
                            <div className="w-0 flex-1 flex flex-col gap h-full overflow-hidden select-text">
                                <div className={cn('text-base cursor-pointer')}>
                                    {SrtUtil.parseSrt(item.srt_str)
                                        .map((line: SrtLine) => {
                                            const isCurrent = isCurrentVideo(item) && isCurrentLine(line);
                                            if (isCurrent) {
                                                lastCurrentLine.current = line;
                                            }
                                            return (<span key={line.index}
                                                          onClick={() => {
                                                              setPlayInfo({
                                                                  video: item,
                                                                  time: line.start - item.start_time,
                                                                  timeUpdated: Date.now()
                                                              });
                                                              setPlay(true);
                                                              console.log('setPlayInfo', line.start, item.start_time);
                                                          }}
                                                          className={cn('hover:underline',
                                                              isCurrent && 'text-primary')}>
                                                {line.contentEn}
                                            </span>
                                            );
                                        })}
                                </div>
                                <div
                                    className={cn('text-sm text-muted-foreground')}>{new Date(item.created_at).toLocaleString() + '     ' + item.video_name}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className={'w-full flex flex-col'}>
                    <AspectRatio ratio={16 / 9}>
                        <div className="w-full rounded-lg overflow-hidden">
                            <ReactPlayer
                                ref={playerRef}
                                url={UrlUtil.file(playInfo?.video.clipPath)}
                                width="100%"
                                height="100%"
                                // onMouseEnter={e => e.currentTarget.play()}
                                // onMouseLeave={e => e.currentTarget.pause()}
                                playing={play}
                                onProgress={(state) => {
                                    setCurrentTime(state.playedSeconds);
                                }}

                                loop
                            />
                        </div>
                    </AspectRatio>
                </div>
            </div>
        </div>
    );
};

export default Favorite;
