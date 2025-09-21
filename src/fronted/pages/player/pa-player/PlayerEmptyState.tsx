import React, {useCallback} from 'react';
import useSWR from 'swr';
import {useNavigate} from 'react-router-dom';
import {Play, Film} from 'lucide-react';
import {Button} from '@/fronted/components/ui/button';
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
        async ([, basePath, fileName, time]) => {
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
            <div className={cn(
                'relative h-full w-full overflow-hidden',
                'bg-gradient-to-br from-slate-900 to-black',
                className
            )}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="relative mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center">
                    <div className="mb-6">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                            <Film className="h-10 w-10 text-white/80" />
                        </div>
                    </div>

                    <h1 className="text-white font-bold leading-tight text-6xl sm:text-7xl md:text-8xl">
                        开启英语学习之旅
                    </h1>
                    <p className="mt-4 text-white/85 leading-snug text-2xl sm:text-3xl md:text-4xl">
                        选择视频，通过双语字幕和智能功能提升英语水平
                    </p>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xl text-white/80 ring-1 ring-white/10">
                        <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                        准备就绪
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('relative h-full w-full overflow-hidden', className)}>
            {/* 背景与遮罩 */}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </div>

            {/* 内容区 */}
            <div className="relative flex h-full flex-col justify-end px-6 pb-12 sm:px-8 md:px-12 lg:px-16">
                <div className="max-w-5xl space-y-8">
                    <h1 className="line-clamp-3 text-white font-bold leading-tight text-5xl sm:text-6xl md:text-7xl">
                        {featured.fileName}
                    </h1>

                    <div className="flex flex-col gap-4 sm:flex-row">
                        <Button
                            className="
                                group flex items-center gap-3 h-auto rounded-xl
                                bg-white px-10 py-5 text-2xl sm:text-3xl font-semibold text-black
                                hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/40
                                active:scale-95 transition
                                min-h-[64px]
                            "
                            size="lg"
                            onClick={hasProgress && !isNearEnd ? handleContinue : handleRestart}
                            aria-label={hasProgress && !isNearEnd ? '继续观看' : '重新观看'}
                        >
                            <Play className="h-7 w-7 sm:h-8 sm:w-8 fill-black" />
                            {hasProgress && !isNearEnd ? '继续观看' : '重新观看'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerEmptyState;
