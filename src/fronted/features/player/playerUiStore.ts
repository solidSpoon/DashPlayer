/**
 * 管理播放器界面展示偏好，例如中英显示、侧栏联动、侧栏译文、逐词模式、硬字幕遮挡，
 * 以及视频控制条是否常驻。
 * 使用 persist 中间件自动持久化到本地浏览器 localStorage。
 */
import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector, type StateStorage } from 'zustand/middleware';
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
  /**
   * 遮挡贴片下沿到播放舞台底部的距离（像素）。
   * 控制条按它判断要不要让位：贴片整体在控制条地盘之上时，控制条就该待在原位。
   */
  hardsubMaskPatchBottomInset: number;
  /** 播放舞台高度（像素），控制条据此限制最多能抬多高，避免被顶出画面。 */
  hardsubMaskStageHeight: number;
  /**
   * 是否正在拖动遮挡贴片。
   * 拖动期间控制条进入「幽灵态」：原地降为半透明、不可交互，充当自己的替身，
   * 让用户看到控制栏此刻在哪、会不会让位，而不用另画一个假的。
   */
  hardsubMaskDragging: boolean;
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
  setHardsubMaskPatchBottomInset: (inset: number) => void;
  setHardsubMaskStageHeight: (height: number) => void;
  setHardsubMaskDragging: (dragging: boolean) => void;
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

/** 贴片宽高的比例下限：防止被拖成零尺寸后彻底抓不到。 */
const MIN_HARDSUB_MASK_SIZE = 0.005;

/** 需要落入 localStorage 的偏好字段。 */
type PersistedPreferenceKey =
  | 'showEn'
  | 'showCn'
  | 'showSourceZh'
  | 'showSideTranslation'
  | 'syncSide'
  | 'showWordLevel'
  | 'controlBarPinned'
  | 'hardsubMaskOn';

/** 需要写入 localStorage 的用户偏好：取值与 store 初始值同源，rehydrate 与迁移都用它。 */
const PERSISTED_DEFAULTS: Pick<PlayerUiState, PersistedPreferenceKey> = {
  showEn: true,
  showCn: true,
  showSourceZh: true,
  showSideTranslation: true,
  syncSide: false,
  showWordLevel: false,
  controlBarPinned: false,
  hardsubMaskOn: false,
};

/**
 * localStorage 适配层：要写入的内容与上次完全相同时直接跳过。
 *
 * persist 中间件每次 `set` 都会同步写一遍存储，而这个 store 有高频的运行时状态：
 * 拖动遮挡贴片时每帧都在改 hovering / dragging / insets，它们不在 partialize 的落盘字段里，
 * 序列化结果一字不变，写入却照样发生。这里按「内容没变就不写」挡掉。
 *
 * @returns 可直接交给 `createJSONStorage` 的存储实现。
 */
function createContentDedupedStorage(): StateStorage {
  const lastPayload = new Map<string, string>();
  return {
    getItem: (name) => {
      const value = window.localStorage.getItem(name);
      if (value !== null) {
        lastPayload.set(name, value);
      }
      return value;
    },
    setItem: (name, value) => {
      if (lastPayload.get(name) === value) {
        return;
      }
      lastPayload.set(name, value);
      window.localStorage.setItem(name, value);
    },
    removeItem: (name) => {
      lastPayload.delete(name);
      window.localStorage.removeItem(name);
    },
  };
}

/**
 * 把任意来源的贴片矩形收敛成合法值。
 *
 * 非法数据（NaN、缺失字段、旧版本残留）会让贴片尺寸变成 NaN 而彻底消失，所以这里兜住三件事：
 * 非有限数退回默认值、宽高有下限、右沿与下沿收进画面。
 *
 * @param rect 待校验的矩形，允许缺字段。
 * @returns 合法矩形，`x + w <= 1`、`y + h <= 1` 恒成立。
 */
export function normalizeHardsubMaskRect(rect: Partial<HardsubMaskRect> | null | undefined): HardsubMaskRect {
  const pick = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
  const w = clamp(pick(rect?.w, DEFAULT_HARDSUB_MASK_RECT.w), MIN_HARDSUB_MASK_SIZE, 1);
  const h = clamp(pick(rect?.h, DEFAULT_HARDSUB_MASK_RECT.h), MIN_HARDSUB_MASK_SIZE, 1);
  return {
    w,
    h,
    x: clamp(pick(rect?.x, DEFAULT_HARDSUB_MASK_RECT.x), 0, 1 - w),
    y: clamp(pick(rect?.y, DEFAULT_HARDSUB_MASK_RECT.y), 0, 1 - h),
  };
}

/**
 * 从完整 store 状态里挑出要落盘的偏好字段。
 *
 * 不能整个 store 落盘：hovering / dragging / insets 这些运行时状态一旦写入，
 * 拖动中途退出会让控制条重启后卡在幽灵态，拖动时还会每帧同步写一次 localStorage。
 *
 * @param state 可能是完整的 store 状态，也可能是从磁盘读回来的旧对象。
 * @returns 只含偏好字段的对象（矩形已校验）。
 */
function pickPersisted(
  state: Partial<PlayerUiState>
): Pick<PlayerUiState, PersistedPreferenceKey> & { hardsubMaskRect: HardsubMaskRect } {
  return {
    showEn: state.showEn ?? PERSISTED_DEFAULTS.showEn,
    showCn: state.showCn ?? PERSISTED_DEFAULTS.showCn,
    showSourceZh: state.showSourceZh ?? PERSISTED_DEFAULTS.showSourceZh,
    showSideTranslation: state.showSideTranslation ?? PERSISTED_DEFAULTS.showSideTranslation,
    syncSide: state.syncSide ?? PERSISTED_DEFAULTS.syncSide,
    showWordLevel: state.showWordLevel ?? PERSISTED_DEFAULTS.showWordLevel,
    controlBarPinned: state.controlBarPinned ?? PERSISTED_DEFAULTS.controlBarPinned,
    hardsubMaskOn: state.hardsubMaskOn ?? PERSISTED_DEFAULTS.hardsubMaskOn,
    hardsubMaskRect: normalizeHardsubMaskRect(state.hardsubMaskRect),
  };
}

export const usePlayerUi = create(
  persist(
    subscribeWithSelector<PlayerUiState & PlayerUiActions>((set) => ({
      ...PERSISTED_DEFAULTS,
      hardsubMaskRect: { ...DEFAULT_HARDSUB_MASK_RECT },
      hardsubMaskPatchTopInset: 0,
      hardsubMaskPatchBottomInset: 0,
      hardsubMaskStageHeight: 0,
      hardsubMaskDragging: false,
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
      setHardsubMaskPatchBottomInset: (inset) => set(() => ({ hardsubMaskPatchBottomInset: inset })),
      setHardsubMaskStageHeight: (height) => set(() => ({ hardsubMaskStageHeight: height })),
      setHardsubMaskDragging: (dragging) => set(() => ({ hardsubMaskDragging: dragging })),
      setHardsubMaskRect: (rect) => set(() => ({ hardsubMaskRect: normalizeHardsubMaskRect(rect) })),
    })),
    {
      name: 'dash-player-subtitle-tracks',
      /** 内容没变就不落盘：运行时状态高频变化时避开每帧一次同步写。 */
      storage: createJSONStorage(createContentDedupedStorage),
      /** 老版本把运行时状态也写进了同一个 key，升一版把它们清掉。 */
      version: 1,
      partialize: (state) => pickPersisted(state),
      /**
       * 只留偏好字段：`partialize` 只影响写入，存储里已有的旧键仍会被 merge 合并回来，
       * 所以读回来时也在这里挑一遍，顺带校验贴片矩形。
       */
      migrate: (persistedState) => pickPersisted((persistedState ?? {}) as Partial<PlayerUiState>),
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
