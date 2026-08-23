import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import React, { useEffect } from 'react';
import { cn } from '@/fronted/lib/utils';
import UrlUtil from '@/common/utils/UrlUtil';
import { Button } from '@/fronted/components/ui/button';
import { Trash2, Play } from 'lucide-react';
import { ClipMeta, OssBaseMeta, ClipSrtLine } from '@/common/types/clipMeta';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('FavouriteItem');

const FavouriteItem = ({ item }: { item: OssBaseMeta & ClipMeta }) => {
  logger.debug('Rendering favourite item', { key: item.key, videoName: item.video_name });

  const playInfo = useFavouriteClip((state) => state.playInfo);
  const setPlayInfo = useFavouriteClip((state) => state.setPlayInfo);
  const deleteClip = useFavouriteClip((state) => state.deleteClip);

  // 跟随播放器 currentSentence 做高亮
  const currentSentence = usePlayer((state) => state.currentSentence);

  const [currentLine, setCurrentLine] = React.useState<ClipSrtLine | null>(null);
  const lines: ClipSrtLine[] = React.useMemo(() => item?.clip_content ?? [], [item]);

  useEffect(() => {
    // 仅当当前播放的视频就是本 item 时才做行高亮
    if (playInfo?.video.key !== item.key) {
      if (currentLine) window.setTimeout(() => setCurrentLine(null), 0);
      return;
    }
    if (!currentSentence) {
      if (currentLine) window.setTimeout(() => setCurrentLine(null), 0);
      return;
    }
    const idx = currentSentence.index;
    const line = lines[idx] ?? null;
    if (line !== currentLine) {
      window.setTimeout(() => setCurrentLine(line), 0);
    }
  }, [playInfo?.video.key, item.key, currentSentence, lines, currentLine]);

  const isCurrentPlaying = playInfo?.video.key === item.key;

  return (
    <div
      key={item.key}
      className={cn(
        'group relative flex items-start gap-3.5 rounded-xl p-3 mb-2.5 transition-all duration-200 border border-border/60 bg-card/60 hover:bg-card hover:border-border hover:shadow-xs select-text',
        isCurrentPlaying && 'bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20'
      )}
    >
      {/* 缩略图区域 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setPlayInfo({
            video: item,
            time: lines[0]?.start ?? 0,
            timeUpdated: Date.now(),
            sentenceIndex: 0
          });
        }}
        className="relative flex flex-col w-36 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden border border-border/60 bg-muted cursor-pointer group/thumb"
      >
        <img
          className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
          src={UrlUtil.toUrl(item.baseDir, item.thumbnail_file)}
          alt=""
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/35 flex items-center justify-center transition-colors">
          <div className={cn(
            'w-7 h-7 rounded-full bg-background/90 text-foreground flex items-center justify-center shadow-xs transition-transform group-hover/thumb:scale-110',
            isCurrentPlaying && 'bg-primary text-primary-foreground'
          )}>
            <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
          </div>
        </div>
      </div>

      {/* 文本内容与信息 */}
      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch gap-2.5">
        {/* 字幕上下文段落 */}
        <div className="text-sm leading-relaxed text-foreground/90 space-x-1 cursor-pointer">
          {lines.map((contextLine: ClipSrtLine, index) => {
            const isHighlight = contextLine === currentLine && isCurrentPlaying;
            return (
              <span
                key={`${item.key}-${index}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPlayInfo({
                      video: item,
                      time: contextLine.start,
                      timeUpdated: Date.now(),
                      sentenceIndex: index
                    });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayInfo({
                    video: item,
                    time: contextLine.start,
                    timeUpdated: Date.now(),
                    sentenceIndex: index
                  });
                  logger.debug('Setting play info for line', { startTime: contextLine.start, sentenceIndex: index });
                }}
                className={cn(
                  'rounded px-1 py-0.5 transition-colors',
                  contextLine.isClip ? 'font-semibold text-foreground bg-primary/10' : 'text-muted-foreground hover:text-foreground',
                  isHighlight && 'bg-primary text-primary-foreground font-bold shadow-xs'
                )}
              >
                {contextLine.contentEn}
              </span>
            );
          })}
        </div>

        {/* 底部元数据栏与操作 */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
            <span className="shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
            <span className="opacity-40">•</span>
            <span className="truncate" title={item.video_name}>{item.video_name}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
            onClick={async (e) => {
              e.stopPropagation();
              deleteClip(item.key);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FavouriteItem;
