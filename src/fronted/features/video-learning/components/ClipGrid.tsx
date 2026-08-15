import React from 'react';
import { Play, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import { VideoClip } from '../types';
import UrlUtil from '@/common/utils/UrlUtil';
import { cn } from '@/fronted/lib/utils';

type Props = {
  clips: VideoClip[];
  playingKey?: string;
  thumbnails?: Record<string, string>;
  onClickClip: (index: number) => void;
};

export default function ClipGrid({ clips, playingKey, thumbnails, onClickClip }: Props) {
  const getThumbnailUrlSync = (clip: VideoClip): string => {
    const raw = thumbnails?.[clip.key];
    if (!raw) return '';
    if (raw.startsWith('file://') || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    return UrlUtil.toUrl(raw);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (clips.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-70" />
          <p className="text-lg mb-2">暂无视频片段</p>
          <p className="text-sm">请先添加一些视频片段到收藏</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-none p-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {clips.map((clip, idx) => {
          const title = clip.videoName.split('/').pop() || 'Unknown';
          const thumb = getThumbnailUrlSync(clip);
          const mainClip = clip.clipContent.find((c) => c.isClip) || clip.clipContent[0];
          const subtitle = `${mainClip?.contentEn || ''} ${mainClip?.contentZh || ''}`.trim();
          const isPlaying = clip.key === playingKey;

          return (
            <div
              key={clip.key}
              role="button"
              tabIndex={0}
              className={cn(
                'overflow-hidden rounded-xl cursor-pointer transition-all group bg-card text-card-foreground',
                isPlaying
                  ? 'ring-2 ring-primary/40 shadow-md'
                  : 'hover:shadow-md',
                clip.sourceType === 'local' && !isPlaying
                  ? 'ring-1 ring-dashed ring-amber-400/70 dark:ring-amber-500/70'
                  : undefined
              )}
              onClick={() => onClickClip(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onClickClip(idx);
                }
              }}
            >
              {/* 视频预览图 */}
              <div className="relative bg-muted aspect-[16/7] flex items-center justify-center">
                {thumb ? (
                  <img src={thumb} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className={cn(
                      'w-full h-full flex items-center justify-center text-white/80',
                      clip.sourceType === 'local'
                        ? 'bg-gradient-to-br from-amber-400 to-orange-600'
                        : 'bg-gradient-to-br from-gray-500 to-gray-700'
                    )}
                  >
                    <Play className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-8 h-8 text-white" />
                </div>

                {/* 状态标识 */}
                {isPlaying && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                    播放中
                  </div>
                )}
                {clip.sourceType === 'local' && !isPlaying && (
                  <div className="absolute top-2 left-2 bg-amber-500 text-amber-950 dark:text-amber-50 text-xs px-2 py-1 rounded flex items-center gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
                    处理中
                  </div>
                )}

                {/* hover提示 */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-black/30 text-white/60 p-1 rounded-full cursor-default hover:bg-black/50 hover:text-white/80 transition-colors">
                          <Info className="w-3 h-3" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1">
                          <div>
                            <strong>状态:</strong> {clip.sourceType === 'local' ? '处理中' : '已完成'}
                          </div>
                          <div>
                            <strong>视频名称:</strong> {title}
                          </div>
                          <div>
                            <strong>时间范围:</strong> {formatTime(mainClip?.start || 0)} -{' '}
                            {formatTime(mainClip?.end || 0)}
                          </div>
                          <div>
                            <strong>创建时间:</strong> {new Date(clip.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* 视频信息 */}
              <div className="p-3 bg-card">
                <p className="text-xs text-muted-foreground line-clamp-2">{subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
