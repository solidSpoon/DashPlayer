/**
 * 渲染实际的视频播放器，并负责把播放器事件同步回播放器 store。
 *
 * 职责：
 * - 承载 ReactPlayer 并同步 store 中的播放/seek 状态
 * - 通过 playRequestId 强制执行原生 play()，解决“期望播放已是 true 时点播放无效”的问题
 * - 通过看门狗检测播放卡死（currentTime 长时间不动）并自愈（强制 play → 重建 video 元素）
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player/file';
import { usePlayerState } from '@/fronted/hooks/usePlayerState';
import { usePlayer, type SeekRequest } from '@/fronted/hooks/usePlayer';
import { shallow } from 'zustand/shallow';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('PlayerEngine');

/**
 * 播放器引擎组件入参。
 */
export interface PlayerEngineProps {
  /** ReactPlayer 进度回调间隔，单位毫秒。 */
  progressInterval?: number;
  /** 播放器容器宽度。 */
  width?: string | number;
  /** 播放器容器高度。 */
  height?: string | number;
  /** 底层播放器准备完成后的回调。 */
  onReady?: () => void;
  /** 媒体播放结束后的回调。 */
  onEnded?: () => void;
  /** 向上层暴露内部 video 元素句柄（应使用稳定引用，避免重复触发）。 */
  onProvideVideoElement?: (video: HTMLVideoElement | null) => void;
  /** 透传给播放器容器的样式类名。 */
  className?: string;
}

// 卡死判定参数
const STALL_CHECK_MS = 500;
const STALL_FROZEN_MS = 1200;
const STALL_HEAL_COOLDOWN_MS = 5000;
// 网络加载宽限期：连续加载超过该时长仍未起播才按卡死处理
const LOADING_GRACE_MS = 4000;
// seek 超时：seeking 持续超过该时长仍未结束则视为卡死
const SEEK_TIMEOUT_MS = 2000;
// 单个媒体源的恢复重建上限：超过后停止自动恢复并记录日志
const MAX_RECOVERY_PER_SOURCE = 3;

/**
 * 承载底层媒体播放，并把播放进度、时长和视频元素句柄回传给上层。
 */
const PlayerEngine: React.FC<PlayerEngineProps> = ({
  progressInterval = 50,
  width = 0,
  height = 0,
  onReady,
  onEnded,
  onProvideVideoElement,
  className
}) => {
  const {
    src,
    playing,
    muted,
    volume,
    seekTime,
    playbackRate,
    playRequestId,
    setDuration,
    updateExactPlayTime,
  } = usePlayerState((s) => ({
    src: s.src,
    playing: s.playing,
    muted: s.muted,
    volume: s.volume,
    seekTime: s.seekTime,
    playbackRate: s.playbackRate,
    playRequestId: s.playRequestId,
    setDuration: s.setDuration,
    updateExactPlayTime: s.updateExactPlayTime,
  }), shallow);

  const playerRef = useRef<ReactPlayer>(null);
  // 记录已执行的最新 seek（按值比较去重，避免同一目标重复触发）
  const lastSeekRef = useRef<SeekRequest>({ time: -1, play: true });
  const lastSeekTsRef = useRef<number>(0);
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoGenerationRef = useRef(0);

  // 最新回调引用：避免内联回调导致 effect 反复重建
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onProvideRef = useRef(onProvideVideoElement);
  onProvideRef.current = onProvideVideoElement;

  // 卡死自愈状态
  const stallAttemptRef = useRef(0);
  const lastStallHealAtRef = useRef(0);
  const pendingRecoveryRef = useRef<number | null>(null);
  const [recoveryKey, setRecoveryKey] = useState(0);

  // 记录 seek 开始时间与 seek 期间冻结的当前时间快照（用于 seek 超时判定）
  const seekingSinceRef = useRef(0);
  // 当前媒体源已触发的恢复重建次数（source 变化时重置）
  const recoveryCountRef = useRef(0);

  /**
   * 强制执行原生 video.play()，即使 store 的 playing 已是 true 也会调用。
   * 用于解决“期望播放已是 true 时点播放无效”的问题，以及卡死自愈。
   */
  const nativePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err) => {
          logger.warn('native play() rejected', { error: String(err) });
        });
      }
    } catch (error) {
      logger.warn('native play() threw', { error: String(error) });
    }
  }, []);

  // 订阅 playRequestId：每次显式请求播放（play / togglePlay 开启）都强制执行原生 play()
  useEffect(() => {
    if (playRequestId > 0) {
      nativePlay();
    }
  }, [playRequestId, nativePlay]);

  // seek 执行：防抖合并 + 延迟 200ms，执行时读取最新播放意图
  useEffect(() => {
    if (!playerRef.current) return;
    const next = seekTime;

    if (lastSeekRef.current.time === next.time && (lastSeekRef.current.play ?? true) === (next.play ?? true)) return;

    // 新 seek 到达时，使未完成的卡死恢复失效（用户意图优先）
    pendingRecoveryRef.current = null;

    const now = Date.now();
    const delta = now - lastSeekTsRef.current;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    /**
     * 执行一次实际 seek，并根据播放意图决定是否继续播放。
     * @param sec 目标时间（秒）
     * @param shouldPlay 是否在 seek 后继续播放
     */
    const applySeek = (sec: number, shouldPlay: boolean) => {
      try {
        // FilePlayer 的 seekTo 接受 keepPlaying 参数：play:false 时在原生层强制暂停
        const internal = playerRef.current?.getInternalPlayer() as { seekTo?: (seconds: number, keepPlaying?: boolean) => void } | null;
        if (internal?.seekTo) {
          internal.seekTo(sec, shouldPlay);
        } else {
          playerRef.current?.seekTo(sec, 'seconds');
          // 原生元素无 keepPlaying 参数：按意图显式暂停/播放
          if (!shouldPlay) {
            videoRef.current?.pause();
          }
        }
        seekingSinceRef.current = Date.now();
      } catch (error) {
        logger.error('seek failed', {
          error: error instanceof Error ? error.message : String(error),
          time: sec,
          currentTime: videoRef.current?.currentTime,
          readyState: videoRef.current?.readyState
        });
      }
    };

    const delay = Math.max(0, 200 - delta);
    pendingTimerRef.current = setTimeout(() => {
      // 定时器延迟执行时读取 store 当前 playing 作为权威意图：
      // seek 的 play 意图已写入 store，用户窗口内的播放/暂停也会反映到它，因此这里直接取最新值
      const shouldPlay = usePlayer.getState().playing;
      applySeek(next.time, shouldPlay);
      lastSeekRef.current = next;
      lastSeekTsRef.current = Date.now();
      pendingTimerRef.current = null;
    }, delay);

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [seekTime, nativePlay]);

  // source 变化时清除恢复状态与看门狗观察状态，避免旧代际状态残留
  useEffect(() => {
    pendingRecoveryRef.current = null;
    seekingSinceRef.current = 0;
    recoveryCountRef.current = 0;
    stallAttemptRef.current = 0;
    lastStallHealAtRef.current = 0;
  }, [src]);

  // 看门狗：独立采样媒体状态，检测播放卡死并自愈
  useEffect(() => {
    let lastSeenTime = -1;
    let frozenMs = 0;
    let loadingSince = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    /**
     * 检测到播放卡死后的恢复处理：先强制 play()，仍卡住则重建 video 元素。
     */
    const handleStall = () => {
      const video = videoRef.current;
      if (!video) return;
      // 仅当应用仍期望播放时恢复；暂停/结束则重置尝试计数
      if (!usePlayer.getState().playing || video.ended) {
        stallAttemptRef.current = 0;
        return;
      }

      // 重建后的冷却期：给新元素缓冲/起播时间，避免重建循环
      if (Date.now() - lastStallHealAtRef.current < STALL_HEAL_COOLDOWN_MS) {
        return;
      }

      const attempt = stallAttemptRef.current + 1;
      stallAttemptRef.current = attempt;
      logger.warn('playback stall detected, attempt recovery', {
        attempt,
        currentTime: video.currentTime,
        readyState: video.readyState,
        networkState: video.networkState,
        paused: video.paused,
        seeking: video.seeking
      });

      // 前两次：强制 play()；仍卡住则重建 video 元素
      if (attempt < 3) {
        nativePlay();
        return;
      }

      // 达到当前源的恢复重建上限：停止自动恢复并告警，避免无限重建
      if (recoveryCountRef.current >= MAX_RECOVERY_PER_SOURCE) {
        logger.error('playback stall recovery exhausted', {
          currentTime: video.currentTime,
          readyState: video.readyState,
          networkState: video.networkState,
          recoveryCount: recoveryCountRef.current
        });
        stallAttemptRef.current = 0;
        lastStallHealAtRef.current = Date.now();
        return;
      }

      stallAttemptRef.current = 0;
      recoveryCountRef.current += 1;
      lastStallHealAtRef.current = Date.now();
      const target = video.currentTime;
      pendingRecoveryRef.current = target;
      // 清空对旧元素的引用，避免恢复期间对已卸载元素采样/播放
      videoRef.current = null;
      videoGenerationRef.current = -1;
      onProvideRef.current?.(null);
      setRecoveryKey((k) => k + 1);
      logger.info('recovering by remounting video element', { target, generation: recoveryKey + 1 });
    };

    /**
     * 周期采样媒体状态：检测 currentTime 是否长时间不前进。
     */
    const checkStall = () => {
      const video = videoRef.current;
      if (!video) return;
      const now = Date.now();
      const loading = video.networkState === HTMLMediaElement.NETWORK_LOADING;

      // 追踪连续加载时长；不在加载则清零
      if (loading) {
        if (loadingSince === 0) loadingSince = now;
      } else {
        loadingSince = 0;
      }

      // 应用不期望播放或媒体已结束：重置观察状态
      if (!usePlayer.getState().playing || video.ended) {
        lastSeenTime = -1;
        frozenMs = 0;
        loadingSince = 0;
        stallAttemptRef.current = 0;
        return;
      }

      // seeking 期间：给有限超时；超过 SEEK_TIMEOUT_MS 仍未结束则进入恢复流程
      if (video.seeking) {
        if (seekingSinceRef.current === 0) {
          seekingSinceRef.current = now;
        }
        if (now - seekingSinceRef.current >= SEEK_TIMEOUT_MS) {
          handleStall();
        } else {
          lastSeenTime = video.currentTime;
          frozenMs = 0;
          stallAttemptRef.current = 0;
        }
        return;
      }
      if (seekingSinceRef.current !== 0) {
        // seek 已结束：重置超时记录
        seekingSinceRef.current = 0;
      }

      // 初次加载（尚无足够数据）期间：网络加载中给予有限宽限期；
      // 未在加载或超过宽限仍无数据时视为卡死，累计冻结时间触发恢复（避免加载卡死永不恢复）
      if (video.readyState < 2) {
        lastSeenTime = video.currentTime;
        if (loading && now - loadingSince < LOADING_GRACE_MS) {
          frozenMs = 0;
          return;
        }
        frozenMs += STALL_CHECK_MS;
        if (frozenMs >= STALL_FROZEN_MS) {
          handleStall();
        }
        return;
      }

      // 网络加载中给予有限宽限期；超过宽限仍未起播则继续按冻结时间累计（避免死加载永久卡住）
      if (loading && now - loadingSince < LOADING_GRACE_MS) {
        lastSeenTime = video.currentTime;
        frozenMs = 0;
        return;
      }

      // 原生已暂停但应用仍期望播放：视为卡死（与 currentTime 冻结同样处理）
      if (video.paused) {
        frozenMs += STALL_CHECK_MS;
        if (frozenMs >= STALL_FROZEN_MS) {
          handleStall();
        }
        return;
      }

      if (video.currentTime !== lastSeenTime) {
        lastSeenTime = video.currentTime;
        frozenMs = 0;
        // 播放恢复前进时清零恢复尝试计数
        stallAttemptRef.current = 0;
        return;
      }
      frozenMs += STALL_CHECK_MS;
      if (frozenMs >= STALL_FROZEN_MS) {
        handleStall();
      }
    };

    intervalId = setInterval(checkStall, STALL_CHECK_MS);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [nativePlay, recoveryKey, src]);

  // 卸载时通知上层清除 video 引用（仅组件真正卸载时执行一次）
  useEffect(() => {
    return () => {
      onProvideRef.current?.(null);
    };
  }, []);

  return (
    <ReactPlayer
      key={recoveryKey}
      ref={playerRef}
      url={src || undefined}
      playing={playing}
      muted={muted}
      volume={volume}
      playbackRate={playbackRate}
      width={width}
      height={height}
      progressInterval={progressInterval}
      controls={false}
      tabIndex={-1}
      config={{ attributes: { controlsList: 'nofullscreen' } }}
      className={className}
      onProgress={(p) => {
        if (typeof p.playedSeconds === 'number') {
          updateExactPlayTime(p.playedSeconds);
        }
      }}
      onDuration={(d) => setDuration(d)}
      onError={(e) => {
        // 仅当错误元素仍属于当前代际时才读取其上下文，避免重建/切源竞态下误报
        const errVideo = videoRef.current;
        if (videoGenerationRef.current !== recoveryKey) {
          logger.warn('media error from stale generation', {
            error: String(e),
            playerGeneration: recoveryKey,
            staleGeneration: videoGenerationRef.current
          });
          return;
        }
        const mediaError = errVideo?.error;
        logger.error('media error', {
          error: String(e),
          playerGeneration: recoveryKey,
          mediaErrorCode: mediaError?.code,
          mediaErrorMessage: mediaError?.message,
          currentTime: errVideo?.currentTime,
          readyState: errVideo?.readyState,
          networkState: errVideo?.networkState,
          src: src
        });
      }}
      onBuffer={() => {
        logger.debug('media buffering');
      }}
      onBufferEnd={() => {
        logger.debug('media buffering ended');
      }}
      onReady={() => {
        const internal = playerRef.current?.getInternalPlayer() as HTMLVideoElement | null;
        videoRef.current = internal;
        videoGenerationRef.current = recoveryKey;
        onProvideRef.current?.(internal);

        // 卡死重建恢复：仅当恢复目标仍有效（期间无新 seek）时回到目标时间并继续播放
        const pending = pendingRecoveryRef.current;
        if (pending !== null) {
          pendingRecoveryRef.current = null;
          try {
            playerRef.current?.seekTo(pending, 'seconds');
          } catch (error) {
            logger.warn('recovery seek failed', { error: String(error) });
          }
          // 仅当应用仍期望播放时才恢复播放
          if (usePlayer.getState().playing) {
            nativePlay();
          }
        }

        onReadyRef.current?.();
      }}
      onEnded={() => {
        onEndedRef.current?.();
      }}
    />
  );
};

export default PlayerEngine;
