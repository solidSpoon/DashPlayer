import { MetaData, OssObject } from '@/common/types/OssObject';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import React from 'react';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import { cn } from '@/fronted/lib/utils';
import UrlUtil from '@/common/utils/UrlUtil';
import { Button } from '@/fronted/components/ui/button';
import { Trash2 } from 'lucide-react';


const FavouriteItem = ({ item }: { item: OssObject & MetaData }) => {
    const playInfo = useFavouriteClip(state => state.playInfo);
    const setPlayInfo = useFavouriteClip(state => state.setPlayInfo);
    const currentTime = useFavouriteClip(state => state.currentTime);
    const deleteClip = useFavouriteClip(state => state.deleteClip);
    const lastCurrentLine = React.useRef<SrtLine>();
    const isCurrentVideo = (video: OssObject & MetaData) => {
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
                    src={UrlUtil.dp(item.baseDir, item.thumbnail_file)}
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
                <div className="flex gap-2 items-start">
                    <div
                        className={cn('text-sm text-muted-foreground flex-1 w-0')}>{new Date(item.created_at).toLocaleString() + '     ' + item.video_name}</div>
                    <Button variant={'outline'} size={'icon'} className={'w-5 h-5 hover:bg-red-100'}
                            onClick={async () => {
                                deleteClip(item.key);
                            }}>
                        <Trash2 className={'w-3 h-3'} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FavouriteItem;
