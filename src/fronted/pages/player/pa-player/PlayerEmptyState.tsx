import React, {useCallback} from 'react';
import useSWR from 'swr';
import {useNavigate} from 'react-router-dom';
import {Play, RotateCcw, Film} from 'lucide-react';
import {Button} from '@/fronted/components/ui/button';
import {AspectRatio} from '@/fronted/components/ui/aspect-ratio';
import {cn} from '@/fronted/lib/utils';
import {apiPath, SWR_KEY} from '@/fronted/lib/swr-util';
import WatchHistoryVO from '@/common/types/WatchHistoryVO';
import PathUtil from '@/common/utils/PathUtil';
import UrlUtil from '@/common/utils/UrlUtil';
import MediaUtil from '@/common/utils/MediaUtil';
import {getRendererLogger} from '@/fronted/log/simple-logger';

const api = window.electron;
const logger = getRendererLogger('PlayerEmptyState');

type PlayerEmptyStateProps = {
    className?: string;
};

const PlayerEmptyState: React.FC<PlayerEmptyStateProps> = ({className}) => {
    const navigate = useNavigate();
    const {data: history} = useSWR<WatchHistoryVO[]>(
        apiPath('watch-history/list'),
        () => api.call('watch-history/list')
    );
    const featured = history?.[0];
    const isAudio = featured ? MediaUtil.isAudio(featured.fileName) : false;

    // Check if video has progress or is near end
    const hasProgress = featured && featured.current_position !== undefined && featured.current_position > 0;
    const isNearEnd = featured && featured.duration !== undefined && featured.current_position !== undefined ?
        (featured.duration - featured.current_position) <= 5 : false;

    const {data: thumbnail} = useSWR<string>(
        featured && !isAudio
            ? [
                SWR_KEY.SPLIT_VIDEO_THUMBNAIL,
                featured.basePath,
                featured.fileName,
                featured.current_position ?? 0,
                'ultra' // Use ultra quality for HD background
            ]
            : null,
        async ([, basePath, fileName, time, quality]) => {
            return await api.call('split-video/thumbnail', {
                filePath: PathUtil.join(basePath as string, fileName as string),
                time: time as number,
                quality: 'ultra', // Ultra HD quality
                width: 1920, // Full HD width
                format: 'jpg'
            });
        }
    );

    const handleNavigate = useCallback((target: WatchHistoryVO | undefined) => {
        if (!target) {
            return;
        }
        navigate(`/player/${target.id}`);
    }, [navigate]);

    const handleContinue = useCallback(() => {
        handleNavigate(featured);
    }, [handleNavigate, featured]);

    const handleRestart = useCallback(async () => {
        if (!featured) {
            return;
        }
        try {
            await api.call('watch-history/progress/update', {
                file: PathUtil.join(featured.basePath, featured.fileName),
                currentPosition: 0,
            });
        } catch (error) {
            logger.error('failed to reset watch progress', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        handleNavigate(featured);
    }, [featured, handleNavigate]);

    if (!featured) {
        return (
            <div className={cn('relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-900 to-black', className)}>
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
                </div>

                {/* Content overlay */}
                <div className="relative flex h-full flex-col items-center justify-center p-16 text-center">
                    <div className="mb-8">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                            <Film className="h-10 w-10 text-white/60" />
                        </div>
                    </div>
                    <div className="max-w-2xl space-y-4">
                        <h1 className="text-4xl font-bold text-white">开始你的观影之旅</h1>
                        <p className="text-xl text-white/80">
                            从左侧的文件列表选择一个视频，或者导入新的文件开始播放
                        </p>
                        <div className="pt-6">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/60 backdrop-blur-sm">
                                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                                准备就绪
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('relative h-full w-full overflow-hidden', className)}>
            {/* Background with overlay */}
            <div className="absolute inset-0">
                {thumbnail ? (
                    <img
                        src={UrlUtil.file(thumbnail)}
                        alt={featured.fileName}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black">
                        <Film className="h-24 w-24 text-zinc-600" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            </div>

            {/* Content overlay */}
            <div className="relative flex h-full flex-col justify-end p-16">
                <div className="max-w-4xl space-y-8">
                    <h1 className="line-clamp-3 text-5xl font-bold text-white drop-shadow-lg">
                        {featured.fileName}
                    </h1>

                    <div className="flex flex-col gap-6 sm:flex-row sm:gap-4">
                        <Button
                            className="group flex items-center gap-3 bg-white text-black hover:bg-gray-200 text-xl py-4 px-12 h-auto rounded-lg font-semibold transition-all hover:scale-105"
                            size="lg"
                            onClick={hasProgress && !isNearEnd ? handleContinue : handleRestart}
                        >
                            <Play className="h-8 w-8 fill-black" />
                            {hasProgress && !isNearEnd ? '继续观看' : '重新观看'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerEmptyState;
