/**
 * 管理播放器界面展示偏好，例如中英显示、侧栏联动、逐词模式，以及视频控制条是否常驻。
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
  /** 视频控制条是否钉住常显（关闭时普通视图条超时淡出、全屏条鼠标移出淡出）。 */
  controlBarPinned: boolean;
};

type PlayerUiActions = {
  changeShowEn: () => void;
  changeShowCn: () => void;
  changeShowSourceZh: () => void;
  changeShowEnCn: () => void;
  changeSyncSide: () => void;
  changeShowWordLevel: () => void;
  toggleControlBarPinned: () => void;
};

export const usePlayerUi = create(
  persist(
    subscribeWithSelector<PlayerUiState & PlayerUiActions>((set) => ({
      showEn: true,
      showCn: true,
      showSourceZh: true,
      syncSide: false,
      showWordLevel: false,
      controlBarPinned: false,

      changeShowEn: () => set((s) => ({ showEn: !s.showEn })),
      changeShowCn: () => set((s) => ({ showCn: !s.showCn })),
      changeShowSourceZh: () => set((s) => ({ showSourceZh: !s.showSourceZh })),
      changeShowEnCn: () => set((s) => ({ showEn: !s.showEn, showCn: !s.showEn })),
      changeSyncSide: () => set((s) => ({ syncSide: !s.syncSide })),
      changeShowWordLevel: () => set((s) => ({ showWordLevel: !s.showWordLevel })),
      toggleControlBarPinned: () => set((s) => ({ controlBarPinned: !s.controlBarPinned })),
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
