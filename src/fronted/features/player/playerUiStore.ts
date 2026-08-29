/**
 * 管理播放器字幕展示偏好，例如中英显示、侧栏联动和逐词模式。
 * 使用 persist 中间件自动持久化到本地浏览器 localStorage。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';

type PlayerUiState = {
  showEn: boolean;
  showCn: boolean;
  showSourceZh: boolean;
  syncSide: boolean;
  showWordLevel: boolean;
};

type PlayerUiActions = {
  changeShowEn: () => void;
  changeShowCn: () => void;
  changeShowSourceZh: () => void;
  changeShowEnCn: () => void;
  changeSyncSide: () => void;
  changeShowWordLevel: () => void;
};

export const usePlayerUi = create(
  persist(
    subscribeWithSelector<PlayerUiState & PlayerUiActions>((set) => ({
      showEn: true,
      showCn: true,
      showSourceZh: true,
      syncSide: false,
      showWordLevel: false,

      changeShowEn: () => set((s) => ({ showEn: !s.showEn })),
      changeShowCn: () => set((s) => ({ showCn: !s.showCn })),
      changeShowSourceZh: () => set((s) => ({ showSourceZh: !s.showSourceZh })),
      changeShowEnCn: () => set((s) => ({ showEn: !s.showEn, showCn: !s.showEn })),
      changeSyncSide: () => set((s) => ({ syncSide: !s.syncSide })),
      changeShowWordLevel: () => set((s) => ({ showWordLevel: !s.showWordLevel })),
    })),
    {
      name: 'dash-player-subtitle-tracks',
    }
  )
);

const playerUiStore = usePlayerUi;

export function usePlayerUiState<T>(
    selector: (s: PlayerUiState & PlayerUiActions) => T,
    equalityFn?: (a: T, b: T) => boolean
): T {
    return useStoreWithEqualityFn(playerUiStore, selector, equalityFn);
}

export default usePlayerUi;
