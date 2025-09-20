import React, { useEffect, useRef } from 'react';
import ReactPlayer from 'react-player/file';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { shallow } from 'zustand/shallow';

export interface PlayerEngineV2Props {
  progressInterval?: number;
  width?: string | number;
  height?: string | number;
  onReady?: () => void;
  onEnded?: () => void;
}

const PlayerEngineV2: React.FC<PlayerEngineV2Props> = ({
  progressInterval = 50,
  width = 0,
  height = 0,
  onReady,
  onEnded
}) => {
  const {
    src,
    playing,
    muted,
    volume,
    seekTime,
    playbackRate,
    setDuration,
    updateExactPlayTime,
    play
  } = usePlayerV2((s) => ({
    src: s.src,
    playing: s.playing,
    muted: s.muted,
    volume: s.volume,
    seekTime: s.seekTime,
    playbackRate: s.playbackRate,
    setDuration: s.setDuration,
    updateExactPlayTime: s.updateExactPlayTime,
    play: s.play
  }), shallow);

  const playerRef = useRef<ReactPlayer>(null);
  const lastSeekRef = useRef<{ time: number }>({ time: -1 });
  const lastSeekTsRef = useRef<number>(0);
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!playerRef.current) return;
    const next = seekTime;

    if (lastSeekRef.current === next) return;

    const now = Date.now();
    const delta = now - lastSeekTsRef.current;

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    const applySeek = (sec: number) => {
      try {
        playerRef.current?.seekTo(sec, 'seconds');
        play();
      } catch {
        // ignore
      }
    };

    const delay = Math.max(0, 200 - delta);
    pendingTimerRef.current = setTimeout(() => {
      applySeek(next.time);
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
  }, [seekTime, play]);

  return (
    <ReactPlayer
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
      onProgress={(p) => {
        if (typeof p.playedSeconds === 'number') {
          updateExactPlayTime(p.playedSeconds);
        }
      }}
      onDuration={(d) => setDuration(d)}
      onReady={onReady}
      onEnded={onEnded}
    />
  );
};

export default PlayerEngineV2;