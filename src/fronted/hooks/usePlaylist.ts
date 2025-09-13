import { useCallback, useMemo, useState } from 'react';
import { VideoClip } from './useClipTender';

type State = {
  clipIdx: number;
  lineIdx: number;
  seekBaseSec: number; // 相对播放器时间基准，通常等于 clip.clipBeginAt 或 0（裁切视频）
};

export function usePlaylist(clips: VideoClip[]) {
  const [state, setState] = useState<State>({ clipIdx: -1, lineIdx: -1, seekBaseSec: 0 });
  const currentClip: VideoClip | null = useMemo(
    () => (state.clipIdx >= 0 ? clips[state.clipIdx] : null),
    [clips, state.clipIdx]
  );

  const playCenterOf = useCallback((idx: number) => {
    const clip = clips[idx];
    if (!clip) return;
    const centerIdx = clip.clipContent.findIndex((l) => l.isClip);
    const lineIdx = centerIdx >= 0 ? centerIdx : Math.floor((clip.clipContent.length || 1) / 2);
    setState({
      clipIdx: idx,
      lineIdx,
      seekBaseSec: clip.clipBeginAt ?? 0,
    });
  }, [clips]);

  const onClipClick = useCallback((idx: number) => {
    if (idx === state.clipIdx) {
      // 同一个视频，重置到中间句
      playCenterOf(idx);
    } else {
      playCenterOf(idx);
    }
  }, [state.clipIdx, playCenterOf]);

  const goToLine = useCallback((lineIdx: number) => {
    if (!currentClip) return;
    const safe = Math.max(0, Math.min(lineIdx, currentClip.clipContent.length - 1));
    setState((s) => ({ ...s, lineIdx: safe }));
  }, [currentClip]);

  const nextSentence = useCallback(() => {
    const clip = currentClip;
    if (!clip) return;
    if (state.lineIdx < clip.clipContent.length - 1) {
      goToLine(state.lineIdx + 1);
    } else if (state.clipIdx < clips.length - 1) {
      // 跨视频：下一个视频的中间句
      playCenterOf(state.clipIdx + 1);
    }
  }, [currentClip, state.lineIdx, state.clipIdx, clips.length, goToLine, playCenterOf]);

  const prevSentence = useCallback(() => {
    const clip = currentClip;
    if (!clip) return;
    if (state.lineIdx > 0) {
      goToLine(state.lineIdx - 1);
    } else if (state.clipIdx > 0) {
      // 跨视频：上一个视频的中间句
      playCenterOf(state.clipIdx - 1);
    }
  }, [currentClip, state.lineIdx, state.clipIdx, goToLine, playCenterOf]);

  const onEnded = useCallback(() => {
    // 视频自然播完，行为等价"下一句"
    nextSentence();
  }, [nextSentence]);

  return {
    state,
    currentClip,
    onClipClick,
    playCenterOf,
    goToLine,
    nextSentence,
    prevSentence,
    onEnded,
  };
}