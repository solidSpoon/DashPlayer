import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import PlayerEngineV2 from '@/fronted/components/PlayerEngineV2';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import TagSelector from '@/fronted/components/TagSelector';
import FavouriteMainSrt from './FavouriteMainSrt';
import VideoPlayerShortcut from '@/fronted/components/video-learning/VideoPlayerShortcut';
import { Button } from '@/fronted/components/ui/button';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/fronted/components/ui/slider';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';
import UrlUtil from '@/common/utils/UrlUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('FavouritePlayer');

const FavouritePlayer = () => {
  const [ready, setReady] = useState(false);
  const bootOnceRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null); // 当前已加载的视频 key

  const playInfo = useFavouriteClip((state) => state.playInfo);

  const {
    playing,
    duration,
    autoPause,
    singleRepeat,
    volume,
    muted,
    playbackRate,

    // 播放控制
    play,
    togglePlay,
    seekTo,
    setVolume,
    setMuted,
    setPlaybackRate,

    // 模式控制
    setAutoPause,
    setSingleRepeat,

    // 字幕/源
    setSource,
    loadSubtitles,
    clearSubtitles,
    getExactPlayTime,

    // 高级API
    prevSentence,
    nextSentence,
    repeatCurrent,
    gotoSentenceIndex,

    // 只读选择器
    isAtFirstSentence,
    isAtLastSentence,

    // 用于 index 检查
    sentences
  } = usePlayerV2();

  // playInfo 变化：仅在切换视频时重新加载；同视频则就地 seek
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
    const videoUrl =
      video?.baseDir && video?.clip_file ? UrlUtil.file(video.baseDir, video.clip_file) : '';
    const videoKey = video.key;
    const isSameClip = loadedKeyRef.current === videoKey;

    if (!isSameClip) {
      // 切换视频：重载源与字幕
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
      // 同一视频：ready 后就地 seek（重复点击重复 seek，由于 playInfo.timeUpdated 每次变化）
      if (ready) {
        // 使用当前 sentences 而不是依赖项中的 sentences
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

  // 播放器就绪：执行首次跳转
  const handlePlayerReady = useCallback(() => {
    setReady(true);

    if (!bootOnceRef.current && playInfo) {
      bootOnceRef.current = true;

      // 使用当前 sentences 而不是依赖项中的 sentences
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

      {/* 播放控制栏 */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <Button variant="outline" size="icon" onClick={togglePlay} disabled={!ready}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        <Button variant="outline" size="icon" onClick={() => prevSentence()} disabled={!ready || isAtFirstSentence()}>
          <SkipBack className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={() => nextSentence()} disabled={!ready || isAtLastSentence()}>
          <SkipForward className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={() => repeatCurrent({ loop: false })} disabled={!ready}>
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* 进度条（仅显示） */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-12 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-muted rounded-full h-2" />
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full h-2 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-12">{formatTime(duration)}</span>
        </div>

        {/* 音量控制 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMuted(!muted)} disabled={!ready}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[muted ? 0 : volume]}
            onValueChange={([value]) => setVolume(value)}
            max={1}
            min={0}
            step={0.1}
            className="w-20"
            disabled={!ready}
          />
        </div>

        {/* 播放速度 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{playbackRate.toFixed(1)}x</span>
          <Slider
            value={[playbackRate]}
            onValueChange={([value]) => setPlaybackRate(value)}
            max={2}
            min={0.5}
            step={0.1}
            className="w-20"
            disabled={!ready}
          />
        </div>

        {/* 模式控制 */}
        <Button variant={autoPause ? 'default' : 'outline'} size="sm" onClick={() => setAutoPause(!autoPause)} disabled={!ready}>
          自动暂停
        </Button>

        <Button variant={singleRepeat ? 'default' : 'outline'} size="sm" onClick={() => setSingleRepeat(!singleRepeat)} disabled={!ready}>
          单句重复
        </Button>
      </div>

      <TagSelector />
      <FavouriteMainSrt />

      {/* 快捷键 */}
      <VideoPlayerShortcut
        onPlayPause={togglePlay}
        onPrevSentence={() => prevSentence()}
        onNextSentence={() => nextSentence()}
        onRepeatSentence={() => repeatCurrent({ loop: false })}
        onSeekToCurrentStart={() => repeatCurrent({ loop: false })}
        onChangeSingleRepeat={() => setSingleRepeat(!singleRepeat)}
        onChangeAutoPause={() => setAutoPause(!autoPause)}
      />
    </div>
  );
};

export default FavouritePlayer;