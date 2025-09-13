import { useMemo, useRef } from 'react';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { ClipTenderImpl } from '@/fronted/lib/SrtTender';

export type VideoClip = {
  key: string;
  sourceType: 'oss' | 'local';
  videoName: string;
  videoPath: string;
  createdAt: number;
  clipContent: ClipSrtLine[];
};

export function useClipTender(clip: VideoClip | null) {
  const tenderRef = useRef<ClipTenderImpl | null>(null);

  tenderRef.current = useMemo(() => {
    if (!clip) return null;
    return new ClipTenderImpl(clip.clipContent ?? [], clip.key);
  }, [clip?.key]);

  const centerIndex = useMemo(() => {
    if (!clip?.clipContent?.length) return 0;
    const idx = clip.clipContent.findIndex((l) => l.isClip);
    return idx >= 0 ? idx : Math.floor(clip.clipContent.length / 2);
  }, [clip?.key]);

  const pickIndexByTime = (relativeSec: number): number => {
    if (!clip || !tenderRef.current) return 0;
    const cur = tenderRef.current.getByTime(relativeSec);
    return clip.clipContent.findIndex((l) => l.index === cur.index);
  };

  return {
    tender: tenderRef, // tenderRef.current 可调用 mapSeekTime/getByTime
    centerIndex,
    pickIndexByTime,
  };
}