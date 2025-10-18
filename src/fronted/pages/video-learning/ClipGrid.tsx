import React, { useEffect, useMemo } from 'react';
import { Play, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import UrlUtil from '@/common/utils/UrlUtil';
import { VirtuosoGrid } from 'react-virtuoso';

type Props = {
  clips: VideoClip[];
  playingKey?: string;
  thumbnails?: Record<string, string>;
  onClickClip: (index: number) => void;
  ensureThumbnails?: (indices: number[]) => void;
};

export default function ClipGrid({ clips, playingKey, thumbnails, onClickClip, ensureThumbnails }: Props) {
  const getThumbnailUrlSync = (clip: VideoClip): string => {
    const raw = thumbnails?.[clip.key];
    if (!raw) return '';
    if (raw.startsWith('file://') || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    return UrlUtil.file(raw);
  };

  // 计算当前播放项的索引，避免每次 render 都 O(n)
  const playingIndex = useMemo(
    () => (playingKey ? clips.findIndex((c) => c.key === playingKey) : -1),
    [clips, playingKey]
  );

  // 当前播放项变更时补齐缩略图
  useEffect(() => {
    if (playingIndex >= 0) {
      ensureThumbnails?.([playingIndex]);
    }
  }, [playingIndex, ensureThumbnails]);

  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (clips.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <Play className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-2">暂无视频片段</p>
          <p className="text-sm">请先添加一些视频片段到收藏</p>
        </div>
      </div>
    );
  }

  // 自定义 Grid 容器，使用 CSS Grid 实现响应式列数，保持原 Tailwind 风格
  const ListContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => (
      <div
        ref={ref}
        {...props}
        className={[
          'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4',
          // 让虚拟列表撑满父容器
          'h-full',
          props.className || ''
        ].join(' ')}
      />
    )
  );
  ListContainer.displayName = 'ListContainer';

  // 每个格子外层容器（可留空或定制 padding/margin）
  const ItemContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => <div ref={ref} {...props} />
  );
  ItemContainer.displayName = 'ItemContainer';

  return (
    <div className="h-full">
      <VirtuosoGrid
        data={clips}
        overscan={300} // 适度的超前渲染，滚动更顺滑
        components={{ List: ListContainer, Item: ItemContainer }}
        // 让内部 scroller 使用自定义滚动条样式
        style={{ height: '100%' }}
        className="scrollbar-none"
        // 仅生成可视区域缩略图
        rangeChanged={({ startIndex, endIndex }) => {
          if (ensureThumbnails) {
            const buffer = 15; // 缓冲区减少滚动抖动
            const start = Math.max(0, startIndex - buffer);
            const end = Math.min(clips.length - 1, endIndex + buffer);
            const indices: number[] = [];
            for (let i = start; i <= end; i++) indices.push(i);
            ensureThumbnails(indices);
          }
        }}
        itemContent={(idx, clip) => {
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
              className={`border rounded-lg overflow-hidden cursor-pointer transition-all group ${
                isPlaying
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : clip.sourceType === 'local'
                    ? 'border-yellow-300 dark:border-yellow-600 hover:shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:shadow-lg'
              }`}
              onClick={() => onClickClip(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClickClip(idx);
                }
              }}
            >
              {/* 视频预览图 */}
              <div className="relative bg-gray-100 aspect-[16/7] flex items-center justify-center">
                {thumb ? (
                  <img src={thumb} alt={title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center ${
                      clip.sourceType === 'local'
                        ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
                        : 'bg-gradient-to-br from-gray-400 to-gray-600'
                    }`}
                  >
                    <Play className="w-8 h-8 text-white/80" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-8 h-8 text-white" />
                </div>

                {/* 状态标识 */}
                {isPlaying && (
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    播放中
                  </div>
                )}
                {clip.sourceType === 'local' && !isPlaying && (
                  <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
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
              <div className="p-2 bg-white dark:bg-gray-800">
                <p className="text-xs text-gray-600 line-clamp-2">{subtitle}</p>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
