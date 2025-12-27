import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import useFile from '@/fronted/hooks/useFile';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import { Nullable } from '@/common/types/Types';
import StrUtil from '@/common/utils/str-util';
import TransHolder from '@/common/utils/TransHolder';
import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;

export interface PlayInfo {
  video: ClipMeta & OssBaseMeta;
  /**
   * 从 0 开始的时间
   */
  time: number;
  timeUpdated: number;
  /**
   * 目标句子索引（可选）
   */
  sentenceIndex?: number;
}

type UseFavouriteClipState = {
  playInfo: PlayInfo | null;
  currentTime: number;
  lineClip: Map<string, boolean>;
  transMap: TransHolder<string>;
};
type UseFavouriteClipActions = {
  setPlayInfo: (playInfo: PlayInfo | null) => void;
  setCurrentTime: (currentTime: number) => void;
  changeCurrentLineClip: () => void;
  updateClipInfo: (srtKey: string, indexesInSrt: number[]) => Promise<void>;
  deleteClip: (key: string) => void;
};

export const mapClipKey = (srtKey: Nullable<string>, indexInSrt: number) => `${srtKey}::=::${indexInSrt}`;

const useFavouriteClip = create(
  subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set, get) => ({
    playInfo: null,
    currentTime: 0,
    lineClip: new Map(),
    transMap: TransHolder.from(new Map()),
    setPlayInfo: (playInfo: PlayInfo | null) => {
      set({ playInfo });
    },
    setCurrentTime: (currentTime: number) => {
      set({ currentTime });
    },
    changeCurrentLineClip: async () => {
      // 使用 PlayerV2 的 currentSentence（替换旧的 usePlayerController）
      const currentSentence = usePlayerV2.getState().currentSentence;
      const videoPath = useFile.getState().videoPath;
      const srtHash = useFile.getState().srtHash;
      if (!videoPath || !srtHash || !currentSentence) {
        return;
      }
      const key = mapClipKey(srtHash, currentSentence.index);
      let exists = get().lineClip.get(key);
      if (exists === undefined) {
        exists = await api
          .call('favorite-clips/exists', {
            srtKey: srtHash,
            linesInSrt: [currentSentence.index]
          })
          .then((map) => map.get(currentSentence.index) ?? false);
      }
      set((state) => {
        const lineClip = new Map(state.lineClip);
        lineClip.set(key, !exists);
        return { lineClip };
      });
      if (exists) {
        await api.call('favorite-clips/cancel-add', { srtKey: srtHash, indexInSrt: currentSentence?.index });
      } else {
        await api.call('favorite-clips/add', {
          videoPath,
          srtKey: srtHash,
          indexInSrt: currentSentence?.index
        });
      }
    },
    updateClipInfo: async (srtKey: string, indexesInSrt: number[]) => {
      const mapping = await api.call('favorite-clips/exists', { srtKey, linesInSrt: indexesInSrt });
      set((state) => {
        const lineClip = new Map(state.lineClip);
        for (const [indexInSrt, exists] of mapping) {
          const key = mapClipKey(srtKey, indexInSrt);
          lineClip.set(key, exists);
        }
        return { lineClip };
      });
    },
    deleteClip: async (key: string) => {
      await api.call('favorite-clips/delete', key);
      await swrApiMutate('favorite-clips/search');
      useFile.setState({
        subtitlePath: null
      });
      set((state) => {
        const lineClip = new Map(state.lineClip);
        lineClip.set(key, false);
        return { lineClip };
      });
    }
  }))
);

/**
 * 加载与翻译（去掉 srtTender，直接基于 clip_content 批量翻译）
 */
useFavouriteClip.subscribe(
  (s) => s.playInfo?.video.clip_content,
  async (clipContent) => {
    if (!clipContent) {
      useFavouriteClip.setState({
        transMap: TransHolder.from(new Map())
      });
      return;
    }
    getRendererLogger('useFavouriteClip').debug('clip content translation', { clipContent });
    const currentHolder = useFavouriteClip.getState().transMap;
    const param = clipContent
      .filter((s) => StrUtil.isNotBlank(s.contentEn))
      .filter((s) => !currentHolder.get(s.contentEn))
      .map((s) => s.contentEn);
    getRendererLogger('useFavouriteClip').debug('clip content translation param', { param });

    if (param.length === 0) return;

    const transHolder = TransHolder.from(await api.call('ai-trans/batch-translate', param));
    useFavouriteClip.setState({
      transMap: transHolder.merge(currentHolder)
    });
  }
);

export default useFavouriteClip;
