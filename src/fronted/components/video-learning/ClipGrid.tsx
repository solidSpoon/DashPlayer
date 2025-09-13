import React from 'react';
import { Play, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import UrlUtil from '@/common/utils/UrlUtil';

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
    // 普通本地路径转为 file://
    return UrlUtil.file(raw);
  };

  const getStartTime = (clip: VideoClip): number => {
    const mainClip = clip.clipContent.find((c) => c.isClip) || clip.clipContent[0];
    return mainClip?.start || 0;
  };

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {clips.map((clip, idx) => {
        const title = clip.videoName.split('/').pop() || 'Unknown';
        const thumb = getThumbnailUrlSync(clip);
        const mainClip = clip.clipContent.find((c) => c.isClip) || clip.clipContent[0];
        const subtitle = `${mainClip?.contentEn || ''} ${mainClip?.contentZh || ''}`.trim();

        return (
          <div
            key={clip.key}
            className={`border rounded-lg overflow-hidden cursor-pointer transition-all group ${
              clip.key === playingKey
                ? 'border-blue-500 ring-2 ring-blue-200'
                : clip.sourceType === 'local'
                  ? 'border-yellow-300 dark:border-yellow-600 hover:shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-lg'
            }`}
            onClick={() => onClickClip(idx)}
          >
            {/* 视频预览图 */}
            <div className="relative bg-gray-100 aspect-[16/7] flex items-center justify-center">
              {thumb ? (
                <img src={thumb} alt={title} className="w-full h-full object-cover" />
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
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Play className="w-8 h-8 text-white" />
              </div>

              {/* 状态标识 */}
              {clip.key === playingKey && (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                  播放中
                </div>
              )}
              {clip.sourceType === 'local' && clip.key !== playingKey && (
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
      })}
    </div>
  );
}