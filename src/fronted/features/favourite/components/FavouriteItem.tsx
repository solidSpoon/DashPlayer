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
  // 提取纯文件名，避免显示过长且杂乱的绝对路径
  const displayName = item.video_name ? item.video_name.split('/').pop()?.replace(/\.[^/.]+$/, '') || item.video_name : '';

  return (
    <div
      key={item.key}
      className={cn(
        'group relative flex items-start gap-3.5 px-3 py-3 rounded-xl transition-colors duration-150 select-text',
        isCurrentPlaying ? 'bg-primary/8' : 'hover:bg-muted/50'
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
        className="relative flex flex-col w-32 sm:w-36 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer"
      >
        <img
          className="w-full h-full object-cover"
          src={UrlUtil.toUrl(item.baseDir, item.thumbnail_file)}
          alt=""
          loading="lazy"
        />
        {/* 轻量播放指示标记（仅在当前播放中或鼠标悬停在封面上时轻微显现） */}
        <div className={cn(
          'absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity',
          isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          <div className={cn(
            'w-6 h-6 rounded-full bg-background/90 text-foreground flex items-center justify-center shadow-xs',
            isCurrentPlaying && 'bg-primary text-primary-foreground'
          )}>
            <Play className="w-3 h-3 ml-0.5 fill-current" />
          </div>
        </div>
      </div>

      {/* 文本内容与信息 */}
      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch gap-1.5">
        {/* 字幕上下文段落 */}
        <div className="text-[13px] leading-relaxed text-foreground/80 space-x-1 cursor-pointer">
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
                  isHighlight && 'bg-primary text-primary-foreground font-bold'
                )}
              >
                {contextLine.contentEn}
              </span>
            );
          })}
        </div>

        {/* 底部元数据栏与操作 */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground/70">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
            <span className="shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
            <span className="opacity-30">•</span>
            <span className="truncate text-muted-foreground/60" title={item.video_name}>{displayName}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={async (e) => {
              e.stopPropagation();
              deleteClip(item.key);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FavouriteItem;
