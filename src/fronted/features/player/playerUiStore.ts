/**
 * 管理播放器界面展示偏好，例如中英显示、侧栏联动、侧栏译文、逐词模式、硬字幕遮挡，
 * 以及视频控制条是否常驻。
 * 使用 persist 中间件自动持久化到本地浏览器 localStorage。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';

type PlayerUiState = {
  showEn: boolean;
  showCn: boolean;
  showSourceZh: boolean;
  /** 右侧字幕列表是否显示译文（原文行恒显示）。与主字幕区的 showCn / showSourceZh 互不影响。 */
  showSideTranslation: boolean;
  syncSide: boolean;
  showWordLevel: boolean;
  /** 视频控制条是否钉住常显（关闭时普通视图条超时淡出、全屏条鼠标移出淡出）。 */
  controlBarPinned: boolean;
  /** 是否用遮挡带盖住画面内嵌的硬字幕（画面自带、无法通过关闭字幕轨道去掉的那种）。 */
  hardsubMaskOn: boolean;
  /** 遮挡贴片在画面内的相对位置与尺寸（均为 0~1 的比例，随画面尺寸缩放）。 */
  hardsubMaskRect: HardsubMaskRect;
  /**
   * 遮挡贴片上沿到播放舞台底部的距离（像素）。控制条据此抬高到贴片之上，
   * 否则两者叠在同一块区域：面板压在贴片上，鼠标够不到贴片，贴片也挡住面板。
   */
  hardsubMaskPatchTopInset: number;
  /** 播放舞台高度（像素），控制条据此限制最多能抬多高，避免被顶出画面。 */
  hardsubMaskStageHeight: number;
  /**
   * 鼠标是否压在遮挡贴片上（含拖动中）。
   * 视频控制条据此让位：两者都是「悬停才现身」的浮层，压在同一块区域会互相抢事件。
   */
  hardsubMaskHovering: boolean;
};

type PlayerUiActions = {
  changeShowEn: () => void;
  changeShowCn: () => void;
  changeShowSourceZh: () => void;
  changeShowSideTranslation: () => void;
  changeShowEnCn: () => void;
  changeSyncSide: () => void;
  changeShowWordLevel: () => void;
  toggleControlBarPinned: () => void;
  toggleHardsubMask: () => void;
  setHardsubMaskRect: (rect: HardsubMaskRect) => void;
  setHardsubMaskHovering: (hovering: boolean) => void;
  setHardsubMaskPatchTopInset: (inset: number) => void;
  setHardsubMaskStageHeight: (height: number) => void;
};

/** 遮挡贴片的矩形：x/y 为左上角、w/h 为宽高，均为相对画面尺寸的比例。 */
export interface HardsubMaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 默认贴片：画面底部一条通栏，对准绝大多数硬字幕的位置。 */
export const DEFAULT_HARDSUB_MASK_RECT: HardsubMaskRect = { x: 0.04, y: 0.82, w: 0.92, h: 0.12 };

export const usePlayerUi = create(
  persist(
    subscribeWithSelector<PlayerUiState & PlayerUiActions>((set) => ({
      showEn: true,
      showCn: true,
      showSourceZh: true,
      showSideTranslation: true,
      syncSide: false,
      showWordLevel: false,
      controlBarPinned: false,
      hardsubMaskOn: false,
      hardsubMaskRect: { ...DEFAULT_HARDSUB_MASK_RECT },
      hardsubMaskPatchTopInset: 0,
      hardsubMaskStageHeight: 0,
      hardsubMaskHovering: false,

      changeShowEn: () => set((s) => ({ showEn: !s.showEn })),
      changeShowCn: () => set((s) => ({ showCn: !s.showCn })),
      changeShowSourceZh: () => set((s) => ({ showSourceZh: !s.showSourceZh })),
      changeShowSideTranslation: () => set((s) => ({ showSideTranslation: !s.showSideTranslation })),
      changeShowEnCn: () => set((s) => ({ showEn: !s.showEn, showCn: !s.showEn })),
      changeSyncSide: () => set((s) => ({ syncSide: !s.syncSide })),
      changeShowWordLevel: () => set((s) => ({ showWordLevel: !s.showWordLevel })),
      toggleControlBarPinned: () => set((s) => ({ controlBarPinned: !s.controlBarPinned })),
      toggleHardsubMask: () => set((s) => ({ hardsubMaskOn: !s.hardsubMaskOn })),
      setHardsubMaskHovering: (hovering) => set(() => ({ hardsubMaskHovering: hovering })),
      setHardsubMaskPatchTopInset: (inset) => set(() => ({ hardsubMaskPatchTopInset: inset })),
      setHardsubMaskStageHeight: (height) => set(() => ({ hardsubMaskStageHeight: height })),
      setHardsubMaskRect: (rect) =>
        set(() => ({
          hardsubMaskRect: {
            x: Math.min(Math.max(0, rect.x), 1),
            y: Math.min(Math.max(0, rect.y), 1),
            w: Math.min(Math.max(0, rect.w), 1),
            h: Math.min(Math.max(0, rect.h), 1),
          },
        })),
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
