// src/fronted/playerV2/usePlayerV2.ts
import { create } from 'zustand';
import { Sentence } from '@/common/types/SentenceC';
import { SrtTender, SrtTenderImpl } from '@/fronted/lib/SrtTender';
import StrUtil from '@/common/utils/str-util';
import useFile from '@/fronted/hooks/useFile';
import usePlayerToaster from '@/fronted/hooks/usePlayerToaster';
import useSetting from '@/fronted/hooks/useSetting';

const api = window.electron;

export type SeekAction = { time: number } | ((prev: { time: number }) => { time: number });
type Range = { start: number; end: number };

const OVERDUE_TIME = 600;
const SEEK_OVERRIDE_MS = 500; // 跳转后的覆盖时间窗口（优先使用目标 seek 时间）
const CURRENT_LOCK_MS = 500;  // 跳转后的 currentSentence 锁定时长（禁止时间回写高亮）

interface TailPreviewState {
  active: boolean;
  untilTs: number;
  returnStart: number;
}

interface TimeOverrideState {
  active: boolean;
  time: number;
  untilTs: number;
}

interface CurrentLockState {
  active: boolean;
  untilTs: number;
  key: string | null; // 锁定的句子 key（用于调试/核对），不参与逻辑判断
}

interface InternalState {
  exactPlayTime: number;
  onPlaySeekTime: number | null;
  lastSeekAt: number;
  tailPreview: TailPreviewState | null;
  timeOverride: TimeOverrideState | null;
  currentLock: CurrentLockState | null;

  // 新增：只读选择器的索引缓存
  indexing: IndexingCache | null;
}

// 高效只读选择器所需：一次性构建 key -> position 与 index -> position 的索引缓存
type IndexingCache = {
  posMap: Map<string, number>;
  // 若 index 在当前上下文中唯一（单文件字幕），可直接 O(1) 跳转
  indexPos: Map<number, number>;
  count: number;
};

type NavUnit =
  | { type: 'sentence'; s: Sentence }
  | { type: 'vg'; sentences: Sentence[]; repr: Sentence };

interface VirtualGroupState {
  active: boolean;
  sentences: Sentence[];
}

interface PlayerState {
  // 媒体源与基础播放态
  src: string | null;
  playing: boolean;
  muted: boolean;
  volume: number;
  duration: number;
  playbackRate: number;
  seekTime: { time: number };

  // 模式
  autoPause: boolean;
  singleRepeat: boolean;
  autoPlayNext: boolean;

  // 字幕
  srtTender: SrtTender<Sentence> | null;
  sentences: Sentence[];
  currentSentence: Sentence | null;

  // 虚拟组
  virtualGroup: VirtualGroupState;

  // 内部状态
  internal: InternalState;

  // 源与字幕
  setSource: (src: string | null) => void;
  loadSubtitles: (sentences: Sentence[], tender?: SrtTender<Sentence>) => void;
  clearSubtitles: () => void;

  // 播放控制
  play: () => void;
  pause: () => void;
  togglePlay: () => void;

  // 基础 seek（保留）：按时间立即匹配高亮（用于进度条等）
  seekTo: (seekTime: SeekAction) => void;

  // 新：带目标句的 seek，立即设定 currentSentence + timeOverride + currentLock（推荐用于上一句/下一句/跳转）
  seekToTarget: (opts: { time: number; target?: Sentence; overrideMs?: number; lockMs?: number }) => void;

  setDuration: (duration: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  cyclePlaybackRate: () => void;

  // 模式控制
  setAutoPause: (v: boolean) => void;
  setSingleRepeat: (v: boolean) => void;
  setAutoPlayNext: (v: boolean) => void;

  // 时间同步
  updateExactPlayTime: (currentTime: number) => void;
  getExactPlayTime: () => number;

  // 范围辅助
  mapCurrentRange: () => Range;
  getVirtualGroupRange: () => Range | null;
  getLoopRange: () => Range;

  // 播放起点延迟（配合 autoPause）
  onPlaySeek: (time: number | null) => void;

  // 虚拟组
  setVirtualGroupBySentences: (ss: Sentence[]) => void;
  setVirtualGroupByIndexRange: (startIndex: number, endIndex: number) => void;
  clearVirtualGroup: () => void;

  // 高级 API —— 跳转/重复/调校
  nextSentence: (step?: number) => void;
  prevSentence: (step?: number) => void;
  gotoSentenceIndex: (index: number) => void;
  gotoSentence: (s: Sentence) => void;
  repeatCurrent: (options?: { loop?: boolean }) => void;
  clearAdjust: () => Promise<void>;
  seekToCurrentStart: () => void;
  seekToCurrentEnd: (epsilon?: number) => void;

  adjustCurrentBegin: (deltaSeconds: number) => void;
  adjustCurrentEnd: (deltaSeconds: number, options?: { previewMs?: number }) => void;

  // 便捷别名
  bumpBegin: (deltaSeconds: number) => void;
  bumpEnd: (deltaSeconds: number) => void;

  // 只读选择器（高效）
  getFocusedSentencePublic: () => Sentence | null;
  getFocusedIndex: () => number;       // 0..count-1；无聚焦返回 -1
  getSentenceCount: () => number;      // 总句数
  isAtFirstSentence: () => boolean;
  isAtLastSentence: () => boolean;
  getFocusedLogicalIndex: () => number;   // 逻辑行索引（虚拟组压缩）
  getLogicalCount: () => number;          // 逻辑行数量
  isAtFirstLogical: () => boolean;
  isAtLastLogical: () => boolean;
}

// 模块内定时器（不放入 Zustand）
let timeOverrideTimer: ReturnType<typeof setTimeout> | null = null;
let currentLockTimer: ReturnType<typeof setTimeout> | null = null;

export const usePlayerV2 = create<PlayerState>((set, get) => {
  // 工具：句子 key
  const sentenceKey = (s: Sentence) => `${(s as any).fileHash ?? 'nofile'}-${s.index}`;

  // O(n) 快路径：若 sentences 已按 index 非递减，则直接线性构建
  const isNonDecreasingByIndex = (arr: Sentence[]) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1].index > arr[i].index) return false;
    }
    return true;
  };

  // 构建索引缓存：key -> position、index -> position、总数
  const buildIndexingCache = (sentences: Sentence[]): IndexingCache => {
    const n = sentences.length;
    if (n === 0) return { posMap: new Map(), indexPos: new Map(), count: 0 };

    // 注意：posMap/indexPos 均以"当前 sentences 数组的位置"为准（不依赖排序结果）
    const posMap = new Map<string, number>();
    const indexPos = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const s = sentences[i];
      posMap.set(sentenceKey(s), i);
      // 假设 index 在当前上下文中唯一（单一文件/源）
      if (!indexPos.has(s.index)) {
        indexPos.set(s.index, i);
      }
    }
    return { posMap, indexPos, count: n };
  };

  // 覆盖某个句子（根据 key）
  const patchSentenceInStore = (updated: Sentence) => {
    const keyU = sentenceKey(updated);
    set((prev) => {
      const pos = prev.internal.indexing?.posMap.get(keyU);
      if (pos === undefined) {
        // 兜底：退化为 O(n) 替换
        const sentences = prev.sentences.map((s) => sentenceKey(s) === keyU ? updated : s);
        const isCurrent = prev.currentSentence && sentenceKey(prev.currentSentence) === keyU;
        return { sentences, currentSentence: isCurrent ? updated : prev.currentSentence };
      }
      const sentences = prev.sentences.slice();
      sentences[pos] = updated;
      const isCurrent = prev.currentSentence && sentenceKey(prev.currentSentence) === keyU;
      return { sentences, currentSentence: isCurrent ? updated : prev.currentSentence };
    });
  };

  // 多句范围
  const calcRangeForSentences = (srt: SrtTender<Sentence>, arr: Sentence[]): Range => {
    if (!arr || arr.length === 0) return { start: 0, end: 0 };
    let start = Number.POSITIVE_INFINITY;
    let end = 0;
    for (const s of arr) {
      const r = srt.mapSeekTime(s);
      if (r.start < start) start = r.start;
      if (r.end > end) end = r.end;
    }
    if (!isFinite(start)) start = 0;
    return { start, end };
  };

  // 清理尾部预览
  const clearTailPreview = () => {
    set((prev) => ({ internal: { ...prev.internal, tailPreview: null } }));
  };

  // 开启"时间覆盖"窗口
  const activateTimeOverride = (time: number, ms = SEEK_OVERRIDE_MS) => {
    if (timeOverrideTimer) {
      clearTimeout(timeOverrideTimer);
      timeOverrideTimer = null;
    }
    const untilTs = Date.now() + ms;
    set((prev) => ({
      internal: {
        ...prev.internal,
        exactPlayTime: time,
        timeOverride: { active: true, time, untilTs }
      }
    }));
    timeOverrideTimer = setTimeout(() => {
      set((prev) => ({
        internal: { ...prev.internal, timeOverride: null }
      }));
      timeOverrideTimer = null;
    }, ms);
  };

  // 开启"当前句锁定"窗口：禁止按时间回写 currentSentence
  const activateCurrentLock = (target: Sentence | undefined, ms = CURRENT_LOCK_MS) => {
    if (currentLockTimer) {
      clearTimeout(currentLockTimer);
      currentLockTimer = null;
    }
    const key = target ? sentenceKey(target) : null;
    const untilTs = Date.now() + ms;
    set((prev) => ({
      currentSentence: target ?? prev.currentSentence,
      internal: {
        ...prev.internal,
        currentLock: { active: true, untilTs, key }
      }
    }));
    currentLockTimer = setTimeout(() => {
      set((prev) => ({
        internal: { ...prev.internal, currentLock: null }
      }));
      currentLockTimer = null;
    }, ms);
  };

  // 有效时间：timeOverride 优先
  const getEffectiveTime = (): number => {
    const { internal } = get();
    const now = Date.now();
    const ov = internal.timeOverride;
    if (ov?.active && now < ov.untilTs) {
      return ov.time;
    }
    return internal.exactPlayTime;
  };

  const buildNavUnits = (): NavUnit[] => {
    const { sentences, virtualGroup } = get();
    if (sentences.length === 0) return [];

    // 避免不必要的排序：若本身已按 index 非递减，直接使用原数组
    const ordered = isNonDecreasingByIndex(sentences)
      ? sentences
      : [...sentences].sort((a, b) => a.index - b.index);
    if (!virtualGroup.active || virtualGroup.sentences.length === 0) {
      return ordered.map((s) => ({ type: 'sentence' as const, s }));
    }

    const vgSet = new Set(virtualGroup.sentences.map((s) => sentenceKey(s)));
    const groupAll = ordered.filter((s) => vgSet.has(sentenceKey(s)));
    const fallbackRepr = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index)[0];
    const repr = groupAll[0] ?? fallbackRepr;
    const units: NavUnit[] = [];
    let placed = false;

    for (const s of ordered) {
      if (vgSet.has(sentenceKey(s))) {
        if (!placed && repr) {
          units.push({ type: 'vg', sentences: groupAll.length > 0 ? groupAll : [repr], repr });
          placed = true;
        }
        continue;
      }
      units.push({ type: 'sentence', s });
    }

    if (!placed && repr) {
      units.push({ type: 'vg', sentences: groupAll.length > 0 ? groupAll : [repr], repr });
    }

    return units;
  };

  const findFocusedNavIndex = (): number => {
    const units = buildNavUnits();
    if (units.length === 0) return -1;
    const focus = getFocusedSentence();
    if (!focus) return -1;
    const key = sentenceKey(focus);
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (unit.type === 'sentence') {
        if (sentenceKey(unit.s) === key) return i;
      } else if (unit.sentences.some((s) => sentenceKey(s) === key)) {
        return i;
      }
    }
    return -1;
  };

  const isFocusInVirtualGroup = (): boolean => {
    const idx = findFocusedNavIndex();
    if (idx < 0) return false;
    const units = buildNavUnits();
    return units[idx]?.type === 'vg';
  };

  const getLogicalCountInternal = (): number => buildNavUnits().length;
  const getFocusedLogicalIndexInternal = (): number => findFocusedNavIndex();

  // overdue：在覆盖窗口内直接放行
  const isTimeOverdue = (lastSeekAt: number): boolean => {
    const { onPlaySeekTime, timeOverride } = get().internal;
    if (onPlaySeekTime) return false;
    if (timeOverride?.active && Date.now() < timeOverride.untilTs) return true;
    return Date.now() - lastSeekAt > OVERDUE_TIME;
  };

  // 时间驱动：优先处理尾部预览；在 currentLock 有效期内跳过"按时间回写 currentSentence"
  const onTimeUpdate = () => {
    const state = get();
    const { playing, autoPause, singleRepeat, currentSentence, srtTender, virtualGroup } = state;
    const { lastSeekAt, tailPreview, currentLock } = state.internal;

    // 1) 尾部预览优先
    if (tailPreview?.active) {
      const now = Date.now();
      if (now >= tailPreview.untilTs) {
        set((prev) => ({
          internal: { ...prev.internal, tailPreview: null }
        }));
        if (singleRepeat) {
          state.seekToTarget({ time: tailPreview.returnStart, target: currentSentence ?? undefined });
        } else if (autoPause) {
          state.pause();
          state.onPlaySeek(tailPreview.returnStart);
        }
      }
      return;
    }

    if (!srtTender || !isTimeOverdue(lastSeekAt)) return; // 保留 overdue 门控

    const effectiveTime = getEffectiveTime();

    // 2) AutoPause（基于当前句）
    if (currentSentence && playing && autoPause) {
      const { start, end } = srtTender.mapSeekTime(currentSentence);
      if (effectiveTime > end) {
        state.pause();
        state.onPlaySeek(start);
      }
      return;
    }

    // 3) SingleRepeat：组优先（保留 overdue；单句冻结，虚拟组内允许高亮随时间移动）
    if (playing && singleRepeat) {
      const { start, end } = state.getLoopRange();
      const focusInGroup = isFocusInVirtualGroup();
      if (effectiveTime > end) {
        if (focusInGroup && virtualGroup.active && virtualGroup.sentences.length > 0) {
          const first = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index)[0];
          state.seekToTarget({ time: start, target: first });
        } else {
          state.seekToTarget({ time: start, target: currentSentence ?? undefined });
        }
      }
      // 仅在焦点位于虚拟组内时：允许高亮随时间在组内流动；单句循环保持冻结
      if (focusInGroup && virtualGroup.active && virtualGroup.sentences.length > 0) {
        const vgSet = new Set(virtualGroup.sentences.map((s) => `${(s as any).fileHash ?? 'nofile'}-${s.index}`));
        const next = srtTender.getByTime(effectiveTime);
        const nextKey = `${(next as any).fileHash ?? 'nofile'}-${next.index}`;
        if (vgSet.has(nextKey) && next !== currentSentence) {
          set({ currentSentence: next });
        }
      }
      return; // singleRepeat 分支到此结束（单句冻结 / 组内已更新）
    }

    // 4) 正常模式：按时间回写 currentSentence（若当前未锁定）
    if (!singleRepeat && !autoPause) {
      if (currentLock?.active && Date.now() < currentLock.untilTs) {
        // 锁定期内，不回写，保持 UI 高亮为用户刚选中的句子
        return;
      }
      const next = srtTender.getByTime(effectiveTime);
      if (next !== currentSentence) {
        set({ currentSentence: next });
      }
    }
  };

  // 当前聚焦句（优先 currentSentence，否则按有效时间查找）
  const getFocusedSentence = (): Sentence | null => {
    const { currentSentence, srtTender } = get();
    if (currentSentence) return currentSentence;
    if (srtTender) {
      try {
        const s = srtTender.getByTime(getEffectiveTime());
        return s ?? null;
      } catch {
        return null;
      }
    }
    return null;
  };

  return {
    // 初始
    src: null,
    playing: false,
    muted: false,
    volume: 1,
    duration: 0,
    playbackRate: 1,
    seekTime: { time: 0 },

    autoPause: false,
    singleRepeat: false,
    autoPlayNext: false,

    srtTender: null,
    sentences: [],
    currentSentence: null,

    virtualGroup: {
      active: false,
      sentences: []
    },

    internal: {
      exactPlayTime: 0,
      onPlaySeekTime: null,
      lastSeekAt: 0,
      tailPreview: null,
      timeOverride: null,
      currentLock: null,
      indexing: null // 新增
    },

    // 源与字幕
    setSource: (src) => {
      if (timeOverrideTimer) { clearTimeout(timeOverrideTimer); timeOverrideTimer = null; }
      if (currentLockTimer) { clearTimeout(currentLockTimer); currentLockTimer = null; }
      set({
        src,
        playing: false,
        duration: 0,
        seekTime: { time: 0 },
        virtualGroup: { active: false, sentences: [] },
        internal: {
          exactPlayTime: 0,
          onPlaySeekTime: null,
          lastSeekAt: 0,
          tailPreview: null,
          timeOverride: null,
          currentLock: null,
          indexing: null // 清理索引
        }
      });
    },

    loadSubtitles: (sentences, tender) => {
      const srt = tender ?? new SrtTenderImpl(sentences);
      const indexing = buildIndexingCache(sentences);
      set((prev) => ({
        srtTender: srt,
        sentences,
        currentSentence: sentences.length > 0 ? sentences[0] : null,
        virtualGroup: { active: false, sentences: [] },
        internal: {
          ...prev.internal,
          indexing // 构建索引
        }
      }));
    },

    clearSubtitles: () => {
      set((prev) => ({
        srtTender: null,
        sentences: [],
        currentSentence: null,
        virtualGroup: { active: false, sentences: [] },
        internal: {
          ...prev.internal,
          indexing: null // 清理索引
        }
      }));
    },

    // 播放控制
    play: () => {
      const { onPlaySeekTime } = get().internal;
      if (onPlaySeekTime !== null) {
        get().seekToTarget({ time: onPlaySeekTime, target: get().currentSentence ?? undefined });
      } else {
        set({ playing: true });
      }
    },

    pause: () => set({ playing: false }),

    togglePlay: () => {
      const { playing } = get();
      set({ playing: !playing });
    },

    // 基础 seek：仍然支持"按时间匹配高亮"，用于进度条拖动等通用场景
    seekTo: (seekTime) => {
      const srtTender = get().srtTender;
      const currentSeek = get().seekTime;
      const next = typeof seekTime === 'function' ? seekTime(currentSeek) : seekTime;

      set((prev) => ({
        playing: true,
        seekTime: next,
        currentSentence: srtTender ? srtTender.getByTime(next.time) : prev.currentSentence,
        internal: {
          ...prev.internal,
          onPlaySeekTime: null,
          lastSeekAt: Date.now()
        }
      }));

      activateTimeOverride(next.time, SEEK_OVERRIDE_MS);
    },

    // 推荐：带 target 的 seek（上一句/下一句/跳转都走这里）
    seekToTarget: ({ time, target, overrideMs = SEEK_OVERRIDE_MS, lockMs = CURRENT_LOCK_MS }) => {
      set((prev) => ({
        playing: true,
        seekTime: { time },
        currentSentence: target ?? prev.currentSentence, // 直接设目标句
        internal: {
          ...prev.internal,
          onPlaySeekTime: null,
          lastSeekAt: Date.now()
        }
      }));
      activateTimeOverride(time, overrideMs);
      activateCurrentLock(target, lockMs);
    },

    setDuration: (duration) => set({ duration }),
    setMuted: (muted) => set({ muted }),
    setVolume: (volume) => set({ volume }),
    setPlaybackRate: (rate) => set({ playbackRate: rate }),
    cyclePlaybackRate: () => {
      const stack = useSetting.getState().setting('userSelect.playbackRateStack')
        .split(',')
        .map((v) => parseFloat(v))
        .filter((v) => !Number.isNaN(v));
      if (stack.length === 0) {
        return;
      }
      set((prev) => {
        const current = prev.playbackRate;
        const currentIdx = stack.indexOf(current) === -1 ? 0 : stack.indexOf(current);
        const nextIdx = (currentIdx + 1) % stack.length;
        return { playbackRate: stack[nextIdx] };
      });
    },

    // 模式控制
    setAutoPause: (v) => set({ autoPause: v }),
    setSingleRepeat: (v) => set({ singleRepeat: v }),
    setAutoPlayNext: (v) => set({ autoPlayNext: v }),

    // 时间同步
    updateExactPlayTime: (currentTime: number) => {
      set((prev) => ({
        internal: { ...prev.internal, exactPlayTime: currentTime }
      }));
      setTimeout(onTimeUpdate, 0);
    },

    getExactPlayTime: () => get().internal.exactPlayTime,

    // 范围辅助
    mapCurrentRange: () => {
      const { currentSentence, srtTender } = get();
      if (currentSentence && srtTender) {
        return srtTender.mapSeekTime(currentSentence);
      }
      return { start: 0, end: 0 };
    },

    getVirtualGroupRange: () => {
      const { virtualGroup, srtTender } = get();
      if (!virtualGroup.active || !srtTender || virtualGroup.sentences.length === 0) return null;
      return calcRangeForSentences(srtTender, virtualGroup.sentences);
    },

    getLoopRange: () => {
      const { singleRepeat, virtualGroup, srtTender, currentSentence } = get();
      if (!singleRepeat) {
        return get().mapCurrentRange();
      }
      const focusInGroup = isFocusInVirtualGroup();
      if (focusInGroup && virtualGroup.active && srtTender && virtualGroup.sentences.length > 0) {
        return calcRangeForSentences(srtTender, virtualGroup.sentences);
      }
      if (currentSentence && srtTender) {
        return srtTender.mapSeekTime(currentSentence);
      }
      return { start: 0, end: 0 };
    },

    // 播放起点延迟（配合 autoPause）
    onPlaySeek: (time) => {
      set((prev) => ({ internal: { ...prev.internal, onPlaySeekTime: time } }));
    },

    // 虚拟组
    setVirtualGroupBySentences: (ss) => {
      const sorted = [...ss].sort((a, b) => a.index - b.index);
      set({
        virtualGroup: { active: sorted.length > 0, sentences: sorted }
      });
    },

    setVirtualGroupByIndexRange: (startIndex, endIndex) => {
      const { sentences } = get();
      const min = Math.min(startIndex, endIndex);
      const max = Math.max(startIndex, endIndex);
      const picked = sentences
        .filter((s) => s.index >= min && s.index <= max)
        .sort((a, b) => a.index - b.index);
      set({
        virtualGroup: { active: picked.length > 0, sentences: picked }
      });
    },

    clearVirtualGroup: () => {
      set({ virtualGroup: { active: false, sentences: [] } });
    },

    // 高级 API —— 下一句（虚拟组当作一行）
    nextSentence: (step = 1) => {
      clearTailPreview();
      const { srtTender } = get();
      if (!srtTender) return;

      const units = buildNavUnits();
      if (units.length === 0) return;

      const pos = findFocusedNavIndex();
      if (pos < 0) return;

      const nextIdx = Math.min(units.length - 1, Math.max(0, pos + step));
      const unit = units[nextIdx];

      if (unit.type === 'sentence') {
        const { start } = srtTender.mapSeekTime(unit.s);
        get().seekToTarget({ time: start, target: unit.s });
      } else {
        const range = get().getVirtualGroupRange();
        const start = range ? range.start : srtTender.mapSeekTime(unit.repr).start;
        get().seekToTarget({ time: start, target: unit.repr });
      }
    },

    // 高级 API —— 上一句
    prevSentence: (step = 1) => {
      clearTailPreview();
      const { srtTender } = get();
      if (!srtTender) return;

      const units = buildNavUnits();
      if (units.length === 0) return;

      const pos = findFocusedNavIndex();
      if (pos < 0) return;

      const nextIdx = Math.max(0, Math.min(units.length - 1, pos - step));
      const unit = units[nextIdx];

      if (unit.type === 'sentence') {
        const { start } = srtTender.mapSeekTime(unit.s);
        get().seekToTarget({ time: start, target: unit.s });
      } else {
        const range = get().getVirtualGroupRange();
        const start = range ? range.start : srtTender.mapSeekTime(unit.repr).start;
        get().seekToTarget({ time: start, target: unit.repr });
      }
    },

    // 高级 API —— 跳到指定句（按 index）
    gotoSentenceIndex: (index: number) => {
      clearTailPreview();
      const { sentences, srtTender, internal } = get();
      if (!srtTender) return;
      // O(1) 通过索引缓存定位
      const pos = internal.indexing?.indexPos.get(index);
      const target = (pos !== undefined && pos >= 0 && pos < sentences.length)
        ? sentences[pos]
        : sentences.find((s) => s.index === index);
      if (!target) return;
      const { start } = srtTender.mapSeekTime(target);
      get().seekToTarget({ time: start, target });
    },

    // 高级 API —— 跳到指定句（按对象）
    gotoSentence: (s: Sentence) => {
      clearTailPreview();
      const { srtTender } = get();
      if (!srtTender) return;
      const { start } = srtTender.mapSeekTime(s);
      get().seekToTarget({ time: start, target: s });
    },

    // 高级 API —— 重复当前
    repeatCurrent: (options) => {
      clearTailPreview();
      const loop = options?.loop ?? true;
      if (loop) {
        set({ singleRepeat: true });
        const vg = get().virtualGroup;
        if (vg.active && vg.sentences.length > 0) {
          const first = vg.sentences.slice().sort((a, b) => a.index - b.index)[0];
          const r = get().getVirtualGroupRange();
          const start = r ? r.start : get().mapCurrentRange().start;
          get().seekToTarget({ time: start, target: first });
        } else {
          const { start } = get().mapCurrentRange();
          const cur = get().currentSentence ?? getFocusedSentence() ?? null;
          get().seekToTarget({ time: start, target: cur ?? undefined });
        }
      } else {
        const vg = get().virtualGroup;
        if (vg.active && vg.sentences.length > 0) {
          const first = vg.sentences.slice().sort((a, b) => a.index - b.index)[0];
          const range = get().getVirtualGroupRange();
          const start = range ? range.start : get().mapCurrentRange().start;
          if (first) {
            get().seekToTarget({ time: start, target: first });
            return;
          }
        }
        const { start } = get().mapCurrentRange();
        const cur = get().currentSentence ?? getFocusedSentence() ?? null;
        get().seekToTarget({ time: start, target: cur ?? undefined });
      }
    },

    clearAdjust: async () => {
      const state = get();
      const focus = state.currentSentence;
      const srtTender = state.srtTender;
      if (!focus || !srtTender) {
        return;
      }

      const resetSentence = srtTender.clearAdjust(focus);
      patchSentenceInStore(resetSentence);
      set({ currentSentence: resetSentence });
      state.repeatCurrent({ loop: false });

      const { subtitlePath } = useFile.getState();
      if (StrUtil.isBlank(subtitlePath)) {
        return;
      }

      try {
        await api.call('subtitle-timestamp/delete/by-key', resetSentence.key);
      } catch {
        // ignore backend errors; frontend state already restored
      }
    },

    // 高级 API —— 跳到当前句首
    seekToCurrentStart: () => {
      clearTailPreview();
      const { srtTender, virtualGroup } = get();
      if (!srtTender) return;

      if (virtualGroup.active && virtualGroup.sentences.length > 0 && isFocusInVirtualGroup()) {
        const first = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index)[0];
        if (first) {
          const range = get().getVirtualGroupRange();
          const start = range ? range.start : srtTender.mapSeekTime(first).start;
          get().seekToTarget({ time: start, target: first });
          return;
        }
      }

      const currentSentence = get().currentSentence ?? getFocusedSentence();
      if (!currentSentence) return;
      const { start } = srtTender.mapSeekTime(currentSentence);
      get().seekToTarget({ time: start, target: currentSentence });
    },

    // 高级 API —— 跳到当前句尾
    seekToCurrentEnd: (epsilon = 0.05) => {
      clearTailPreview();
      const { srtTender, virtualGroup } = get();
      if (!srtTender) return;

      if (virtualGroup.active && virtualGroup.sentences.length > 0 && isFocusInVirtualGroup()) {
        const first = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index)[0];
        if (first) {
          const range = get().getVirtualGroupRange();
          const end = range ? range.end : srtTender.mapSeekTime(first).end;
          get().seekToTarget({ time: Math.max(end - epsilon, 0), target: first });
          return;
        }
      }

      const currentSentence = get().currentSentence ?? getFocusedSentence();
      if (!currentSentence) return;
      const { end } = srtTender.mapSeekTime(currentSentence);
      get().seekToTarget({ time: Math.max(end - epsilon, 0), target: currentSentence });
    },

    // 高级 API —— 调整开始时间
    adjustCurrentBegin: (deltaSeconds: number) => {
      const state = get();
      const { srtTender, virtualGroup } = state;
      const focus = getFocusedSentence();
      if (!srtTender) return;

      // 目标句：组内第一句（若组激活且焦点在组内），否则当前焦点句
      let target = focus;
      if (virtualGroup.active && virtualGroup.sentences.length > 0 && isFocusInVirtualGroup()) {
        const first = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index)[0];
        if (first) target = first;
      }
      if (!target) return;

      // 可选安全：避免 begin >= end
      const { start, end } = srtTender.mapSeekTime(target);
      const minGap = 0.02;
      const maxDelta = (end - minGap) - start;
      const safeDelta = deltaSeconds > 0 ? Math.min(deltaSeconds, Math.max(maxDelta, 0)) : deltaSeconds;

      const updated = srtTender.adjustBegin(target, safeDelta);
      patchSentenceInStore(updated);

      state.repeatCurrent({ loop: false });

      const { subtitlePath } = useFile.getState();
      if (StrUtil.isBlank(subtitlePath)) {
        return;
      }

      const diff = srtTender.timeDiff(updated).start;
      const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      usePlayerToaster.getState().setNotification({ type: 'info', text: `start: ${diffStr} s` });

      const { start: start2, end: end2 } = srtTender.mapSeekTime(updated);
      void api.call('subtitle-timestamp/update', {
        key: updated.key,
        subtitle_path: subtitlePath,
        subtitle_hash: useFile.getState().srtHash,
        start_at: start2,
        end_at: end2
      }).catch(() => {
        // ignore backend errors; notification already shown
      });
    },

    // 高级 API —— 调整结束时间（尾部预览 + 立即锁定高亮）
    adjustCurrentEnd: (deltaSeconds: number, options) => {
      const state = get();
      const { srtTender, virtualGroup } = state;
      const focus = getFocusedSentence();
      if (!srtTender) return;

      // 目标句：组内最后一句（若组激活且焦点在组内），否则当前焦点句
      let target = focus;
      if (virtualGroup.active && virtualGroup.sentences.length > 0 && isFocusInVirtualGroup()) {
        const sorted = virtualGroup.sentences.slice().sort((a, b) => a.index - b.index);
        const last = sorted[sorted.length - 1];
        if (last) target = last;
      }
      if (!target) return;

      // 可选安全（如需）：避免 end <= start（与你对 begin 的安全策略对称）
      // const { start, end } = srtTender.mapSeekTime(target);
      // const minGap = 0.02;
      // const maxDelta = Number.POSITIVE_INFINITY; // 允许延长
      // const minDelta = (start + minGap) - end;   // 防止缩短到与 start 交叉
      // const safeDelta = Math.max(deltaSeconds, minDelta);

      const updated = srtTender.adjustEnd(target, deltaSeconds /* 或 safeDelta */);
      patchSentenceInStore(updated);

      state.repeatCurrent({ loop: false });

      const { subtitlePath } = useFile.getState();
      if (!StrUtil.isBlank(subtitlePath)) {
        const diff = srtTender.timeDiff(updated).end;
        const diffStr = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
        usePlayerToaster.getState().setNotification({ type: 'info', text: `end: ${diffStr} s` });

        const { start: start2, end: end2 } = srtTender.mapSeekTime(updated);
        void api.call('subtitle-timestamp/update', {
          key: updated.key,
          subtitle_path: subtitlePath,
          subtitle_hash: useFile.getState().srtHash,
          start_at: start2,
          end_at: end2
        }).catch(() => {
          // ignore backend errors; notification already shown
        });
      }

      const { start, end } = srtTender.mapSeekTime(updated);
      const previewMs = options?.previewMs ?? 1000;
      const epsilon = 0.05;

      set((prev) => ({
        internal: {
          ...prev.internal,
          tailPreview: {
            active: true,
            untilTs: Date.now() + previewMs,
            returnStart: start
          }
        }
      }));

      // 预览尾部：使用带目标的 seek，确保高亮不被 getByTime 干扰
      state.seekToTarget({ time: Math.max(end - epsilon, 0), target: updated });
    },

    // 别名
    bumpBegin: (deltaSeconds) => get().adjustCurrentBegin(deltaSeconds),
    bumpEnd: (deltaSeconds) => get().adjustCurrentEnd(deltaSeconds),

    // 只读选择器实现（均为 O(1)）
    getFocusedSentencePublic: () => {
      const state = get();
      const { currentSentence, srtTender } = state;
      if (currentSentence) return currentSentence;
      if (srtTender) {
        try {
          const s = srtTender.getByTime(state.internal.timeOverride?.active
            && Date.now() < (state.internal.timeOverride?.untilTs ?? 0)
            ? (state.internal.timeOverride?.time ?? state.internal.exactPlayTime)
            : state.internal.exactPlayTime
          );
          return s ?? null;
        } catch {
          return null;
        }
      }
      return null;
    },

    getSentenceCount: () => {
      const { internal, sentences } = get();
      return internal.indexing?.count ?? sentences.length;
    },

    getFocusedIndex: () => {
      const { internal } = get();
      const focus = get().getFocusedSentencePublic();
      if (!focus) return -1;
      const posMap = internal.indexing?.posMap;
      if (!posMap) return -1;
      const key = `${(focus as any).fileHash ?? 'nofile'}-${focus.index}`;
      const pos = posMap.get(key);
      return typeof pos === 'number' ? pos : -1;
    },

    isAtFirstSentence: () => {
      const cnt = get().getSentenceCount();
      if (cnt <= 0) return false;
      const idx = get().getFocusedIndex();
      return idx === 0;
    },

    isAtLastSentence: () => {
      const cnt = get().getSentenceCount();
      if (cnt <= 0) return false;
      const idx = get().getFocusedIndex();
      return idx === cnt - 1;
    },

    getFocusedLogicalIndex: () => getFocusedLogicalIndexInternal(),
    getLogicalCount: () => getLogicalCountInternal(),
    isAtFirstLogical: () => {
      const cnt = getLogicalCountInternal();
      if (cnt <= 0) return false;
      const idx = getFocusedLogicalIndexInternal();
      return idx === 0;
    },
    isAtLastLogical: () => {
      const cnt = getLogicalCountInternal();
      if (cnt <= 0) return false;
      const idx = getFocusedLogicalIndexInternal();
      return idx === cnt - 1;
    },
  };
});
