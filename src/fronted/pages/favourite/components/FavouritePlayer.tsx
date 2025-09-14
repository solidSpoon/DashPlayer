import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import PlayerEngineV2 from '@/fronted/components/PlayerEngineV2';
import TagSelector from '@/fronted/components/TagSelector';
import FavouriteMainSrt from './FavouriteMainSrt';
import VideoPlayerShortcut from '@/fronted/components/video-learning/VideoPlayerShortcut';
import { Button } from '@/fronted/components/ui/button';
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;
const logger = getRendererLogger('FavouritePlayer');

const FavouritePlayer = () => {
  const [ready, setReady] = useState(false);
  const bootOnceRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null);

  const playInfo = useFavouriteClip((state) => state.playInfo);
  const setPlayInfo = useFavouriteClip((state) => state.setPlayInfo);

  const { data: allVideos = [] } = useSWR(
    apiPath('favorite-clips/search'),
    () => api.call('favorite-clips/search', {})
  );

  const {
    playing,
    duration,
    autoPause,
    singleRepeat,
    volume,
    muted,
    playbackRate,

    play,
    togglePlay,
    seekTo,
    setVolume,
    setMuted,
    setPlaybackRate,

    setAutoPause,
    setSingleRepeat,

    setSource,
    loadSubtitles,
    clearSubtitles,
    getExactPlayTime,

    repeatCurrent,
    gotoSentenceIndex,
    prevSentence,
    nextSentence,

    isAtFirstSentence,
    isAtLastSentence,

    sentences
  } = usePlayerV2();

  useEffect(() => {
    if (!playInfo) {
      setSource(null);
      clearSubtitles();
      loadedKeyRef.current = null;
      setReady(false);
      bootOnceRef.current = false;
      return;
    }

    const { video, time, sentenceIndex } = playInfo;
    const videoUrl = video?.baseDir && video?.clip_file ? UrlUtil.file(video.baseDir, video.clip_file) : '';
    const videoKey = video.key;
    const isSameClip = loadedKeyRef.current === videoKey;

    if (!isSameClip) {
      setSource(videoUrl);

      if (video.clip_content) {
        const sentencesConv = convertClipSrtLinesToSentences(video.clip_content, videoKey, videoKey);
        loadSubtitles(sentencesConv);
      }
      loadedKeyRef.current = videoKey;
      setReady(false);
      bootOnceRef.current = false;
      logger.debug('Loaded new clip', { key: videoKey });
    } else {
      if (ready) {
        const currentSentences = usePlayerV2.getState().sentences;
        if (typeof sentenceIndex === 'number' && currentSentences[sentenceIndex]) {
          gotoSentenceIndex(sentenceIndex);
          logger.debug('Seek within same clip by index', { index: sentenceIndex });
        } else {
          seekTo({ time });
          logger.debug('Seek within same clip by time', { time });
        }
        play();
      }
    }
  }, [
    playInfo,
    ready,
    setSource,
    clearSubtitles,
    loadSubtitles,
    gotoSentenceIndex,
    seekTo,
    play
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
    if (isAtFirstSentence()) {
      // 第一句再上一句：跳到上个视频
      goToPreviousVideo();
    } else {
      // 否则使用播放器内部逻辑
      prevSentence();
    }
  }, [isAtFirstSentence, goToPreviousVideo, prevSentence]);

  const handleNextSentence = useCallback(() => {
    if (isAtLastSentence()) {
      // 最后一句再下一句：跳到下个视频
      goToNextVideo();
    } else {
      // 否则使用播放器内部逻辑
      nextSentence();
    }
  }, [isAtLastSentence, goToNextVideo, nextSentence]);

  const handlePlayerReady = useCallback(() => {
    setReady(true);

    if (!bootOnceRef.current && playInfo) {
      bootOnceRef.current = true;

      const currentSentences = usePlayerV2.getState().sentences;
      if (typeof playInfo.sentenceIndex === 'number' && currentSentences[playInfo.sentenceIndex]) {
        gotoSentenceIndex(playInfo.sentenceIndex);
        logger.debug('Initial seek to sentence index', { index: playInfo.sentenceIndex });
      } else {
        seekTo({ time: playInfo.time });
        logger.debug('Initial seek to time', { time: playInfo.time });
      }
      play();
    }
  }, [playInfo, gotoSentenceIndex, seekTo, play]);

  const handlePlayerEnded = useCallback(() => {
    logger.debug('Player ended');
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTime = getExactPlayTime();
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!playInfo) {
    return (
      <div className="w-full flex flex-col gap-4 p-6">
        <div className="text-center text-muted-foreground">请从左侧选择一个收藏片段开始播放</div>
      </div>
    );
  }

  return (
    <div className={'w-full flex flex-col gap-4'}>
      <AspectRatio ratio={16 / 9}>
        <div className="w-full rounded-lg overflow-hidden">
          <PlayerEngineV2 width="100%" height="100%" onReady={handlePlayerReady} onEnded={handlePlayerEnded} />
        </div>
      </AspectRatio>

      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={togglePlay} disabled={!ready}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
              <Button variant="outline" size="icon" onClick={goToPreviousVideo} disabled={!ready || allVideos.length === 0}>
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
              <Button variant="outline" size="icon" onClick={goToNextVideo} disabled={!ready || allVideos.length === 0}>
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
              <Button variant="outline" size="icon" onClick={() => repeatCurrent({ loop: false })} disabled={!ready}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              重复当前句
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-muted rounded-full h-1.5" />
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full h-1.5 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
        </div>
      </div>

      <TagSelector />
      <FavouriteMainSrt />

      <VideoPlayerShortcut
        onPlayPause={togglePlay}
        onPrevSentence={handlePrevSentence}
        onNextSentence={handleNextSentence}
        onRepeatSentence={() => repeatCurrent({ loop: false })}
        onSeekToCurrentStart={() => repeatCurrent({ loop: false })}
        onChangeSingleRepeat={() => setSingleRepeat(!singleRepeat)}
        onChangeAutoPause={() => setAutoPause(!autoPause)}
      />
    </div>
  );
};

export default FavouritePlayer;