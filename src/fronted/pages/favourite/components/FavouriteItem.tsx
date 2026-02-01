import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import React, { useEffect } from 'react';
import { cn } from '@/fronted/lib/utils';
import UrlUtil from '@/common/utils/UrlUtil';
import { Button } from '@/fronted/components/ui/button';
import { Trash2 } from 'lucide-react';
import { ClipMeta, OssBaseMeta, ClipSrtLine } from '@/common/types/clipMeta';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('FavouriteItem');

const FavouriteItem = ({ item }: { item: OssBaseMeta & ClipMeta }) => {
  logger.debug('Rendering favourite item', { key: item.key, videoName: item.video_name });

  const playInfo = useFavouriteClip((state) => state.playInfo);
  const setPlayInfo = useFavouriteClip((state) => state.setPlayInfo);
  const deleteClip = useFavouriteClip((state) => state.deleteClip);

  // 跟随播放器 currentSentence 做高亮
  const currentSentence = usePlayerV2((state) => state.currentSentence);

  const [currentLine, setCurrentLine] = React.useState<ClipSrtLine | null>(null);
  const lines: ClipSrtLine[] = item?.clip_content ?? [];

  useEffect(() => {
    // 仅当当前播放的视频就是本 item 时才做行高亮
    if (playInfo?.video.key !== item.key) {
      if (currentLine) setCurrentLine(null);
      return;
    }
    if (!currentSentence) {
      if (currentLine) setCurrentLine(null);
      return;
    }
    const idx = currentSentence.index;
    const line = lines[idx] ?? null;
    if (line !== currentLine) {
      setCurrentLine(line);
    }
  }, [playInfo?.video.key, item.key, currentSentence, lines, currentLine]);

  return (
    <div key={item.key} className={cn('flex max-w-3xl items-start gap-4 rounded-xl pb-8')}>
      <div className="flex flex-col w-44 gap-1 h-full overflow-hidden p-2 select-text">
        <img
          className={cn('w-full rounded-lg')}
          src={UrlUtil.toUrl(item.baseDir, item.thumbnail_file)}
          style={{ aspectRatio: '16/9' }}
          alt=""
        />
      </div>
      <div className="w-0 flex-1 flex flex-col gap h-full overflow-hidden select-text">
        <div className={cn('text-base cursor-pointer')}>
          {lines.map((contextLine: ClipSrtLine, index) => (
            <span
              key={`${item.key}-${index}`}
              onClick={() => {
                // 重复点击也会触发：timeUpdated 确保状态变化
                setPlayInfo({
                  video: item,
                  time: contextLine.start,
                  timeUpdated: Date.now(),
                  sentenceIndex: index
                });
                logger.debug('Setting play info for line', { startTime: contextLine.start, sentenceIndex: index });
              }}
              className={cn(
                'hover:underline',
                contextLine === currentLine && 'text-primary',
                contextLine.isClip && 'font-bold'
              )}
            >
              {contextLine.contentEn}
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-start">
          <div className={cn('text-sm text-muted-foreground flex-1 w-0')}>
            {new Date(item.created_at).toLocaleString() + '     ' + item.video_name}
          </div>
          <Button
            variant={'outline'}
            size={'icon'}
            className={'w-5 h-5 hover:bg-red-100'}
            onClick={async () => {
              deleteClip(item.key);
            }}
          >
            <Trash2 className={'w-3 h-3'} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FavouriteItem;