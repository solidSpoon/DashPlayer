import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import PlayerEngine from '@/fronted/features/player/components/PlayerEngine';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { shallow } from 'zustand/shallow';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import TagSelector from '@/fronted/features/favourite/components/TagSelector';
import FavouriteMainSrt from './FavouriteMainSrt';
import VideoPlayerShortcut from '@/fronted/features/video-learning/components/VideoPlayerShortcut';
import { Button } from '@/fronted/components/ui/button';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { clipLinesToSentences } from '@/common/utils/subtitle';
import TimeUtil from '@/common/utils/TimeUtil';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { favouriteApi } from '@/fronted/features/favourite/favouriteApi';
import { playerApi } from '@/fronted/features/player/playerApi';

const logger = getRendererLogger('FavouritePlayer');

// 进度条子组件：只订阅 currentTime 和 duration，其他部分不受影响
const FavouriteProgress = memo(function FavouriteProgress() {
  const currentTime = usePlayerState((s) => s.internal.exactPlayTime);
  const duration = usePlayerState((s) => s.duration);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex-1 flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-10 text-right">
        {TimeUtil.secondToTimeStrCompact(currentTime)}
      </span>
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-muted rounded-full h-1.5" />
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full h-1.5 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-10">
        {TimeUtil.secondToTimeStrCompact(duration)}
      </span>
    </div>
  );
});

const FavouritePlayer = () => {
  const [ready, setReady] = useState(false);
  const bootOnceRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null);

  const playInfo = useFavouriteClip((state) => state.playInfo);
  const setPlayInfo = useFavouriteClip((state) => state.setPlayInfo);

  const { data: allVideos = [] } = useSWR(
    apiPath('favorite-clips/search'),
    () => favouriteApi.search()
  );

  // 低频状态：数值/布尔，变化不频繁
  const { playing, autoPause, singleRepeat } = usePlayerState(
    (s) => ({
      playing: s.playing,
      autoPause: s.autoPause,
      singleRepeat: s.singleRepeat
    }),
    shallow
  );

  useEffect(() => {
    if (!playInfo) {
      playerActions.setSource(null);
      playerActions.clearSubtitles();
      loadedKeyRef.current = null;
      window.setTimeout(() => setReady(false), 0);
      bootOnceRef.current = false;
      return;
    }

    const { video, time, sentenceIndex } = playInfo;
    const videoUrl = video?.baseDir && video?.clip_file ? UrlUtil.toUrl(video.baseDir, video.clip_file) : '';
    const videoKey = video.key;
    const isSameClip = loadedKeyRef.current === videoKey;

    if (!isSameClip) {
      playerActions.setSource(videoUrl);
      loadedKeyRef.current = videoKey;
      window.setTimeout(() => setReady(false), 0);
      bootOnceRef.current = false;

      if (video.clip_content) {
        const clipContent = video.clip_content;
        // 先向后端取回句法结构，再加载字幕，使当前句支持单词级词典弹窗与生词高亮。
        playerApi.parseTextStructs(clipContent.map((line) => line.contentEn))
          .then((structs) => {
            // 解析期间可能已切到其它片段，迟到结果不再加载。
            if (loadedKeyRef.current !== videoKey) {
              return;
            }
            const sentencesConv = clipLinesToSentences(clipContent, videoKey, videoKey, structs);
            playerActions.loadSubtitles(sentencesConv);
          })
          .catch((error) => {
            logger.error('failed to parse clip sentence structs', {
              videoKey,
              error: error instanceof Error ? error.message : error
            });
          });
      }
      logger.debug('Loaded new clip', { key: videoKey });
    } else {
      if (ready) {
        const currentSentences = usePlayer.getState().sentences;
        if (typeof sentenceIndex === 'number' && currentSentences[sentenceIndex]) {
          playerActions.gotoSentenceIndex(sentenceIndex);
          logger.debug('Seek within same clip by index', { index: sentenceIndex });
        } else {
          playerActions.seekTo({ time });
          logger.debug('Seek within same clip by time', { time });
        }
        playerActions.play();
      }
    }
  }, [
    playInfo,
    ready
  ]);

  const goToPreviousVideo = useCallback(() => {
    if (!playInfo || allVideos.length === 0) return;

    const currentIndex = allVideos.findIndex(video => video.key === playInfo.video.key);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : allVideos.length - 1;
    const previousVideo = allVideos[previousIndex];

    const mainSentenceIndex = previousVideo.clip_content?.findIndex(line => line.isClip) ?? 0;

    setPlayInfo({
      video: previousVideo,
      time: previousVideo.clip_content?.[mainSentenceIndex]?.start ?? 0,
      timeUpdated: Date.now(),
      sentenceIndex: mainSentenceIndex
    });
    logger.debug('Go to previous video', { videoKey: previousVideo.key, sentenceIndex: mainSentenceIndex });
  }, [playInfo, allVideos, setPlayInfo]);

  const goToNextVideo = useCallback(() => {
    if (!playInfo || allVideos.length === 0) return;

    const currentIndex = allVideos.findIndex(video => video.key === playInfo.video.key);
    const nextIndex = currentIndex < allVideos.length - 1 ? currentIndex + 1 : 0;
    const nextVideo = allVideos[nextIndex];

    const mainSentenceIndex = nextVideo.clip_content?.findIndex(line => line.isClip) ?? 0;

    setPlayInfo({
      video: nextVideo,
      time: nextVideo.clip_content?.[mainSentenceIndex]?.start ?? 0,
      timeUpdated: Date.now(),
      sentenceIndex: mainSentenceIndex
    });
    logger.debug('Go to next video', { videoKey: nextVideo.key, sentenceIndex: mainSentenceIndex });
  }, [playInfo, allVideos, setPlayInfo]);

  // 句子导航处理边界情况
  const handlePrevSentence = useCallback(() => {
    if (playerActions.isAtFirstSentence()) {
      // 第一句再上一句：跳到上个视频
      goToPreviousVideo();
    } else {
      // 否则使用播放器内部逻辑
      playerActions.prevSentence();
    }
  }, [goToPreviousVideo]);

  const handleNextSentence = useCallback(() => {
    if (playerActions.isAtLastSentence()) {
      // 最后一句再下一句：跳到下个视频
      goToNextVideo();
    } else {
      // 否则使用播放器内部逻辑
      playerActions.nextSentence();
    }
  }, [goToNextVideo]);

  const handlePlayerReady = useCallback(() => {
    setReady(true);

    if (!bootOnceRef.current && playInfo) {
      bootOnceRef.current = true;

      const currentSentences = usePlayer.getState().sentences;
      if (typeof playInfo.sentenceIndex === 'number' && currentSentences[playInfo.sentenceIndex]) {
        playerActions.gotoSentenceIndex(playInfo.sentenceIndex);
        logger.debug('Initial seek to sentence index', { index: playInfo.sentenceIndex });
      } else {
        playerActions.seekTo({ time: playInfo.time });
        logger.debug('Initial seek to time', { time: playInfo.time });
      }
      playerActions.play();
    }
  }, [playInfo]);

  const handlePlayerEnded = useCallback(() => {
    logger.debug('Player ended');
  }, []);

  if (!playInfo) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground/60 text-sm">
        选择左侧片段即可播放
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 视频主播放窗口 */}
      <AspectRatio ratio={16 / 9} className="w-full">
        <div className="w-full h-full rounded-xl overflow-hidden bg-black shadow-xs">
          <PlayerEngine width="100%" height="100%" onReady={handlePlayerReady} onEnded={handlePlayerEnded} />
        </div>
      </AspectRatio>

      {/* 控制条：极简通透无外线框 */}
      <div className="flex items-center gap-1.5 px-1 py-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={playing ? 'secondary' : 'default'}
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 shadow-2xs"
                onClick={() => playerActions.togglePlay()}
                disabled={!ready}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {playing ? '暂停' : '播放'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                onClick={goToPreviousVideo}
                disabled={!ready || allVideos.length === 0}
              >
                <SkipBack className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              上一个视频
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                onClick={goToNextVideo}
                disabled={!ready || allVideos.length === 0}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              下一个视频
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => playerActions.repeatCurrent({ loop: false })}
                disabled={!ready}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              重复当前句
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <FavouriteProgress />
      </div>

      {/* 标签管理 */}
      <TagSelector />

      {/* 当前精读金句与翻译 */}
      <FavouriteMainSrt />

      <VideoPlayerShortcut
        onPlayPause={() => playerActions.togglePlay()}
        onPrevSentence={handlePrevSentence}
        onNextSentence={handleNextSentence}
        onRepeatSentence={() => playerActions.repeatCurrent({ loop: false })}
        onChangeSingleRepeat={() => playerActions.setSingleRepeat(!singleRepeat)}
        onChangeAutoPause={() => playerActions.setAutoPause(!autoPause)}
      />
    </div>
  );
};

export default FavouritePlayer;
