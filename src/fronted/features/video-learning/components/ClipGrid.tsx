import React from 'react';
import { Play, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import ConfirmDeleteButton from '@/fronted/components/shared/common/ConfirmDeleteButton';
import { VideoClip } from '../types';
import UrlUtil from '@/common/utils/UrlUtil';
import TimeUtil from '@/common/utils/TimeUtil';
import { cn } from '@/fronted/lib/utils';
import { useTranslation } from 'react-i18next';

type Props = {
  clips: VideoClip[];
  playingKey?: string;
  thumbnails?: Record<string, string>;
  onClickClip: (index: number) => void;
  /** 正在删除的片段键，用于按钮转圈与防重复提交。 */
  deletingKey?: string | null;
  /** 请求删除某个片段，删除逻辑与状态刷新由页面负责。 */
  onDeleteClip: (index: number) => void;
};

export default function ClipGrid({ clips, playingKey, thumbnails, onClickClip, deletingKey, onDeleteClip }: Props) {
  const { t } = useTranslation('common');
  const getThumbnailUrlSync = (clip: VideoClip): string => {
    const raw = thumbnails?.[clip.key];
    if (!raw) return '';
    if (raw.startsWith('file://') || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
    return UrlUtil.toUrl(raw);
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
                    'overflow-hidden rounded-xl cursor-pointer transition-all duration-200 group bg-card text-card-foreground border border-border/60 flex flex-col',
                    isPlaying
                      ? 'ring-2 ring-primary border-transparent shadow-sm'
                      : 'hover:border-border hover:shadow-sm',
                    clip.sourceType === 'local' && !isPlaying
                      ? 'border-dashed border-amber-400/80 dark:border-amber-500/80'
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
                  <div className="relative bg-muted/60 aspect-[16/8.5] flex items-center justify-center overflow-hidden">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={cn(
                          'w-full h-full flex items-center justify-center text-white/80',
                          clip.sourceType === 'local'
                            ? 'bg-gradient-to-br from-amber-400 to-orange-600'
                            : 'bg-gradient-to-br from-slate-600 to-slate-800'
                        )}
                      >
                        <Play className="w-7 h-7" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-background/90 text-foreground flex items-center justify-center shadow-sm">
                        <Play className="w-4 h-4 fill-current translate-x-0.5" />
                      </div>
                    </div>

                    {/* 状态标识 */}
                    {isPlaying && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[11px] font-medium px-2 py-0.5 rounded-md shadow-2xs">
                        播放中
                      </div>
                    )}
                    {clip.sourceType === 'local' && !isPlaying && (
                      <div className="absolute top-2 left-2 bg-amber-500/90 text-white text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs backdrop-blur-xs">
                        <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse"></div>
                        处理中
                      </div>
                    )}

                    {/* hover 操作区：删除（仅已完成片段）与详情提示 */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {clip.sourceType !== 'local' && (
                        <ConfirmDeleteButton
                          title={t('deleteClip')}
                          confirmLabel={t('confirmDelete')}
                          deleting={deletingKey === clip.key}
                          onConfirm={() => onDeleteClip(idx)}
                          triggerClassName="bg-black/40 backdrop-blur-xs text-white/80 hover:bg-black/60 hover:text-white"
                        />
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-black/40 backdrop-blur-xs text-white/80 p-1 rounded-md cursor-default hover:bg-black/60 hover:text-white transition-colors">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            <div className="space-y-1">
                              <div>
                                <strong>状态:</strong> {clip.sourceType === 'local' ? '处理中' : '已完成'}
                              </div>
                              <div>
                                <strong>视频名称:</strong> {title}
                              </div>
                              <div>
                                <strong>时间范围:</strong> {TimeUtil.secondToTimeStrCompact(mainClip?.start || 0)} -{' '}
                                {TimeUtil.secondToTimeStrCompact(mainClip?.end || 0)}
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
                  <div className="p-2.5 bg-card flex-1 flex items-center">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">{subtitle}</p>
                  </div>
                </div>
              );
        })}
      </div>
    </div>
  );
}
