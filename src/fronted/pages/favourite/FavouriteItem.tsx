import { OssObject } from '@/common/types/OssObject';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import React from 'react';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import { cn } from '@/fronted/lib/utils';
import UrlUtil from '@/common/utils/UrlUtil';

const FavouriteItem = ({ item }: { item: OssObject }) => {
    const playInfo = useFavouriteClip(state => state.playInfo);
    const setPlayInfo = useFavouriteClip(state => state.setPlayInfo);
    const currentTime = useFavouriteClip(state => state.currentTime);
    const lastCurrentLine = React.useRef<SrtLine>();
    const isCurrentVideo = (video: OssObject) => {
        return playInfo?.video.key === video.key;
    };
    const isCurrentLine = (line: SrtLine) => {
        const valid = Date.now() - (playInfo?.timeUpdated ?? 0) > 500;
        const ct = valid ? currentTime : (playInfo?.time ?? 0);
        const cs = ct + playInfo?.video.start_time;
        return line.start <= cs && line.end > cs;
    };

    const [clipLine] = SrtUtil.parseSrt(item.srt_clip_with_time);
    const clipIndex = clipLine?.index ?? -1;
    console.log('clipIndex', clipIndex);
    return (
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
            </div>
            <div className="w-0 flex-1 flex flex-col gap h-full overflow-hidden select-text">
                <div className={cn('text-base cursor-pointer')}>
                    {SrtUtil.parseSrt(item.srt_context_with_time)
                        .map((contextLine: SrtLine) => {
                            const isCurrent = isCurrentVideo(item) && isCurrentLine(contextLine);
                            if (isCurrent) {
                                lastCurrentLine.current = contextLine;
                            }

                            return (<span key={contextLine.index}
                                          onClick={() => {
                                              setPlayInfo({
                                                  video: item,
                                                  time: contextLine.start - item.start_time,
                                                  timeUpdated: Date.now()
                                              });
                                              // setPlay(true);
                                              console.log('setPlayInfo', contextLine.start, item.start_time);
                                          }}
                                          className={cn('hover:underline',
                                              isCurrent && 'text-primary',
                                              clipIndex === contextLine.index && 'font-bold'
                                          )}>
                                                {contextLine.contentEn}
                                            </span>
                            );
                        })}
                </div>
                <div
                    className={cn('text-sm text-muted-foreground')}>{new Date(item.created_at).toLocaleString() + '     ' + item.video_name}</div>
            </div>
        </div>
    );
};

export default FavouriteItem;
