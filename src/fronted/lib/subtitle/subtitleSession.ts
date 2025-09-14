import {
  SeekRange,
  SubtitleClock,
  SubtitleSession,
  SubtitleSessionOptions,
  SubtitleSessionState,
  ViewTarget,
  VirtualGroup
} from './types';

/**
 * 内部行记录
 * - baseStart/baseEnd：基线（adjustedStart/End 或原始 start/end）
 * - t1/t2：当前有效时间（= 基线 + 行级微调）
 * - opId：最近"碰触"的递增序号，用于同桶内优先搜索（越新越优先）
 */
interface LineRecord<T> {
  id: string;
  index: number;
  origin: T;
  baseStart: number;
  baseEnd: number;
  t1: number;
  t2: number;
  opId: number;
}

/**
 * 订阅者
 */
interface Subscriber<S, R> {
  selector: (s: S) => R;
  listener: (next: R, prev: R) => void;
  last: R;
}

/**
 * SubtitleSession 实现
 */
export function createSubtitleSession<T>(opts: SubtitleSessionOptions<T>): SubtitleSession<T> {
  const bucketSeconds = Math.max(1, Math.floor(opts.bucketSeconds ?? 10));

  // 底层数据
  let lines: LineRecord<T>[] = [];
  const idToIndex = new Map<string, number>();

  // 时间桶：index -> 该桶内的行（按 opId 降序排序）
  const buckets = new Map<number, LineRecord<T>[]>();

  // 组与组级微调
  const groups = new Map<string, VirtualGroup>();
  const groupDelta = new Map<string, { start: number; end: number }>();
  const lineToGroups = new Map<string, Set<string>>();
  let groupSeq = 0;

  // 查找缓存
  let cacheIndex: number | null = null; // 最近命中行 index
  let backupIndex = 0;                  // 兜底行 index
  let maxOpId = 0;

  // 状态与订阅
  let state: SubtitleSessionState = {
    time: 0,
    activeLineId: null,
    activeView: null,
    groups: [],
    activeViewRange: null
  };
  const subscribers = new Set<Subscriber<SubtitleSessionState, any>>();

  // 工具：通知订阅者
  function emit(nextPartial?: Partial<SubtitleSessionState>) {
    if (nextPartial) {
      state = { ...state, ...nextPartial };
    }
    // 派生 activeViewRange
    const derivedRange = computeActiveViewRange();
    const finalState = (derivedRange === state.activeViewRange)
      ? state
      : { ...state, activeViewRange: derivedRange };
    state = finalState;

    subscribers.forEach(sub => {
      const next = sub.selector(state);
      if (!Object.is(next, sub.last)) {
        const prev = sub.last;
        sub.last = next;
        sub.listener(next, prev);
      }
    });
  }

  // 工具：根据 activeView 或 activeLine 计算视图范围
  function computeActiveViewRange(): SeekRange | null {
    const view = state.activeView;
    if (view) {
      return mapSeekRange(view);
    }
    if (state.activeLineId) {
      return getLineRange(state.activeLineId);
    }
    return null;
  }

  // 初始化行
  initLines(opts.lines);

  function initLines(all: T[]) {
    lines = [];
    idToIndex.clear();
    buckets.clear();
    cacheIndex = null;
    backupIndex = 0;
    maxOpId = 0;

    let index = 0;
    for (const line of all) {
      const id = opts.getId(line);
      const baseStart = findBaseStart(line);
      const baseEnd = findBaseEnd(line);
      const rec: LineRecord<T> = {
        id,
        index,
        origin: line,
        baseStart,
        baseEnd,
        t1: Math.min(baseStart, baseEnd),
        t2: Math.max(baseStart, baseEnd),
        opId: maxOpId++
      };
      lines.push(rec);
      idToIndex.set(id, index);
      index++;
    }
    // 建桶
    for (const rec of lines) {
      addRecordToBuckets(rec);
    }
    // 初始状态
    emit({
      groups: listGroups()
    });
  }

  function findBaseStart(line: T): number {
    const a = opts.getAdjustedStart?.(line);
    return (a ?? null) != null ? (a as number) : opts.getStart(line);
  }
  function findBaseEnd(line: T): number {
    const a = opts.getAdjustedEnd?.(line);
    return (a ?? null) != null ? (a as number) : opts.getEnd(line);
  }

  // 计算某行的 nextStart（用于 isCurrent 的边界扩展）
  function nextStart(rec: LineRecord<T>): number {
    const nextIdx = Math.min(rec.index + 1, lines.length - 1);
    const nextRec = lines[nextIdx];
    return Math.min(nextRec.t1, nextRec.t2);
  }

  // 当前行覆盖判断：time ∈ [min(t1,t2,nextStart), max(t1,t2,nextStart)]
  function isCurrent(rec: LineRecord<T>, time: number): boolean {
    const start = Math.min(rec.t1, rec.t2, nextStart(rec));
    const end = Math.max(rec.t1, rec.t2, nextStart(rec));
    return time >= start && time <= end;
  }

  // 将一行加入对应的时间桶（根据自身 start/end/nextStart 覆盖到的桶）
  function addRecordToBuckets(rec: LineRecord<T>) {
    const [bMin, bMax] = mapBucketRange(rec);
    for (let i = bMin; i <= bMax; i++) {
      const arr = buckets.get(i) ?? [];
      arr.push(rec);
      arr.sort((a, b) => b.opId - a.opId); // opId 降序
      buckets.set(i, arr);
    }
  }

  // 从桶中移除该 index 的记录
  function removeRecordFromBuckets(index: number) {
    const rec = lines[index];
    if (!rec) return;
    const [bMin, bMax] = mapBucketRange(rec);
    for (let i = bMin; i <= bMax; i++) {
      const arr = buckets.get(i) ?? [];
      const pos = arr.findIndex(r => r.index === index);
      if (pos >= 0) {
        arr.splice(pos, 1);
        buckets.set(i, arr);
      }
    }
  }

  // 桶范围映射（包含 nextStart）
  function mapBucketRange(rec: LineRecord<T>): [number, number] {
    const start = Math.min(rec.t1, rec.t2, nextStart(rec));
    const end = Math.max(rec.t1, rec.t2, nextStart(rec));
    const bMin = Math.floor(start / bucketSeconds);
    const bMax = Math.floor(end / bucketSeconds);
    return [bMin, bMax];
  }

  // 重新索引某一行（调整 t1/t2 后调用）
  function reindex(index: number) {
    removeRecordFromBuckets(index);
    const rec = lines[index];
    // 保持 t1 <= t2
    if (rec.t1 > rec.t2) {
      const t = rec.t1;
      rec.t1 = rec.t2;
      rec.t2 = t;
    }
    addRecordToBuckets(rec);

    // 邻居的 nextStart 可能受影响（谨慎起见，重建前一行的桶）
    if (index - 1 >= 0) {
      removeRecordFromBuckets(index - 1);
      addRecordToBuckets(lines[index - 1]);
    }
    cacheIndex = null;
  }

  // ---- Session 接口实现 ----

  function getByTime(time: number): string | null {
    if (lines.length === 0) return null;

    // 尝试缓存
    if (cacheIndex != null) {
      const rec = lines[cacheIndex];
      if (isCurrent(rec, time)) {
        backupIndex = rec.index;
        return rec.id;
      }
    }

    // 主桶
    const idx = Math.floor(time / bucketSeconds);
    const arr = buckets.get(idx) ?? [];
    for (const rec of arr) {
      if (isCurrent(rec, time)) {
        cacheIndex = rec.index;
        backupIndex = rec.index;
        return rec.id;
      }
    }

    // 兜底：返回上次命中的行（更平滑的体验）
    return lines[backupIndex]?.id ?? null;
  }

  function getLine(id: string): T | null {
    const idx = idToIndex.get(id);
    return idx == null ? null : lines[idx].origin;
  }

  function getLineRange(id: string): SeekRange {
    const idx = idToIndex.get(id);
    if (idx == null) return { start: 0, end: 0 };
    const rec = lines[idx];
    return { start: rec.t1, end: rec.t2 };
  }

  function resolveTarget(target: number | string | T | ViewTarget): ViewTarget | null {
    if (typeof target === 'number') {
      const id = getByTime(target);
      return id ? { kind: 'line', id } : null;
    }
    if (typeof target === 'string') {
      if (idToIndex.has(target)) return { kind: 'line', id: target };
      if (groups.has(target)) return { kind: 'group', id: target };
      return null;
    }
    if (typeof target === 'object' && target) {
      if ('kind' in target) return target as ViewTarget;
      const id = opts.getId(target as T);
      return { kind: 'line', id };
    }
    return null;
  }

  function getGroupRange(groupId: string): SeekRange {
    const grp = groups.get(groupId);
    if (!grp || grp.lineIds.length === 0) return { start: 0, end: 0 };
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    for (const id of grp.lineIds) {
      const idx = idToIndex.get(id);
      if (idx == null) continue;
      const rec = lines[idx];
      minStart = Math.min(minStart, rec.t1);
      maxEnd = Math.max(maxEnd, rec.t2);
    }
    if (!isFinite(minStart) || !isFinite(maxEnd)) return { start: 0, end: 0 };
    const delta = groupDelta.get(groupId) ?? { start: 0, end: 0 };
    return { start: minStart + delta.start, end: maxEnd + delta.end };
  }

  function mapSeekRange(target: number | string | T | ViewTarget): SeekRange {
    const v = resolveTarget(target);
    if (!v) return { start: 0, end: 0 };
    if (v.kind === 'line') return getLineRange(v.id);
    return getGroupRange(v.id);
  }

  function setActiveView(target: ViewTarget | null) {
    emit({ activeView: target });
  }

  function getActiveView(): ViewTarget | null {
    return state.activeView;
  }

  function createGroup(lineIds: string[], meta?: Record<string, any>): string {
    const id = `grp-${++groupSeq}`;
    groups.set(id, { id, lineIds: [...lineIds], meta });
    for (const lid of lineIds) {
      const set = lineToGroups.get(lid) ?? new Set<string>();
      set.add(id);
      lineToGroups.set(lid, set);
    }
    emit({ groups: listGroups() });
    return id;
  }

  function updateGroup(groupId: string, lineIds: string[]) {
    const grp = groups.get(groupId);
    if (!grp) return;
    // 清除旧反向映射
    for (const lid of grp.lineIds) {
      lineToGroups.get(lid)?.delete(groupId);
    }
    grp.lineIds = [...lineIds];
    // 建立新反向映射
    for (const lid of grp.lineIds) {
      const set = lineToGroups.get(lid) ?? new Set<string>();
      set.add(groupId);
      lineToGroups.set(lid, set);
    }
    emit({ groups: listGroups() });
  }

  function removeGroup(groupId: string) {
    const grp = groups.get(groupId);
    if (!grp) return;
    for (const lid of grp.lineIds) {
      lineToGroups.get(lid)?.delete(groupId);
    }
    groupDelta.delete(groupId);
    groups.delete(groupId);
    // 若当前视图指向该组，则重置
    if (state.activeView?.kind === 'group' && state.activeView.id === groupId) {
      emit({ activeView: null, groups: listGroups() });
    } else {
      emit({ groups: listGroups() });
    }
  }

  function listGroups(): VirtualGroup[] {
    return Array.from(groups.values()).map(g => ({ id: g.id, lineIds: [...g.lineIds], meta: g.meta }));
  }

  function groupsOfLine(lineId: string): string[] {
    return Array.from(lineToGroups.get(lineId) ?? []);
  }

  function adjustLineStart(id: string, delta: number) {
    const idx = idToIndex.get(id);
    if (idx == null) return;
    const rec = lines[idx];
    rec.t1 = rec.t1 + delta;
    // 保序 + 重新建桶
    bumpIndex(idx);
    reindex(idx);
    emit(); // 可能影响 activeViewRange
  }

  function adjustLineEnd(id: string, delta: number) {
    const idx = idToIndex.get(id);
    if (idx == null) return;
    const rec = lines[idx];
    rec.t2 = rec.t2 + delta;
    bumpIndex(idx);
    reindex(idx);
    emit();
  }

  function clearLineAdjust(id: string) {
    const idx = idToIndex.get(id);
    if (idx == null) return;
    const rec = lines[idx];
    rec.t1 = rec.baseStart;
    rec.t2 = rec.baseEnd;
    bumpIndex(idx);
    reindex(idx);
    emit();
  }

  function adjustGroupStart(groupId: string, delta: number) {
    const d = groupDelta.get(groupId) ?? { start: 0, end: 0 };
    d.start += delta;
    groupDelta.set(groupId, d);
    emit();
  }

  function adjustGroupEnd(groupId: string, delta: number) {
    const d = groupDelta.get(groupId) ?? { start: 0, end: 0 };
    d.end += delta;
    groupDelta.set(groupId, d);
    emit();
  }

  function clearGroupAdjust(groupId: string) {
    groupDelta.delete(groupId);
    emit();
  }

  function timeDiff(target: ViewTarget | string | T): { start: number; end: number } {
    const v = resolveTarget(target);
    if (!v) return { start: 0, end: 0 };
    if (v.kind === 'line') {
      const idx = idToIndex.get(v.id);
      if (idx == null) return { start: 0, end: 0 };
      const rec = lines[idx];
      return { start: rec.t1 - rec.baseStart, end: rec.t2 - rec.baseEnd };
    } else {
      const d = groupDelta.get(v.id) ?? { start: 0, end: 0 };
      return { start: d.start, end: d.end };
    }
  }

  function isLineAdjusted(id: string, deltaThreshold = 0.05): boolean {
    const idx = idToIndex.get(id);
    if (idx == null) return false;
    const rec = lines[idx];
    return Math.abs(rec.t1 - rec.baseStart) > deltaThreshold || Math.abs(rec.t2 - rec.baseEnd) > deltaThreshold;
  }

  function updateLine(newLine: T) {
    const id = opts.getId(newLine);
    const idx = idToIndex.get(id);
    if (idx == null) return;

    const rec = lines[idx];
    const oldBaseStart = rec.baseStart;
    const oldBaseEnd = rec.baseEnd;
    const diffStart = rec.t1 - oldBaseStart;
    const diffEnd = rec.t2 - oldBaseEnd;

    // 新基线（可能来自新的 adjustedStart/End）
    rec.baseStart = findBaseStart(newLine);
    rec.baseEnd = findBaseEnd(newLine);
    // 保持"有效时间"不变（在新基线基础上套用原差值）
    rec.t1 = rec.baseStart + diffStart;
    rec.t2 = rec.baseEnd + diffEnd;
    rec.origin = newLine;

    bumpIndex(idx);
    reindex(idx);
    emit();
  }

  function bumpLine(id: string) {
    const idx = idToIndex.get(id);
    if (idx == null) return;
    bumpIndex(idx);
    reindex(idx);
  }

  function bumpIndex(idx: number) {
    const rec = lines[idx];
    rec.opId = maxOpId++;
  }

  function tick(time: number) {
    // 更新时间
    const id = getByTime(time);
    const activeLineId = id ?? null;
    emit({ time, activeLineId });
  }

  function attachClock(clock: SubtitleClock) {
    const off = clock.onTimeUpdate((t) => tick(t));
    emit({ time: clock.now() });
    return () => off?.();
  }

  function getState(): SubtitleSessionState {
    return state;
  }

  function subscribe<S>(
    selector: (s: SubtitleSessionState) => S,
    listener: (next: S, prev: S) => void
  ) {
    const sub: Subscriber<SubtitleSessionState, S> = {
      selector,
      listener,
      last: selector(state)
    };
    subscribers.add(sub as any);
    return () => subscribers.delete(sub as any);
  }

  return {
    // 查询
    getByTime,
    getLine,
    getLineRange,
    mapSeekRange,

    // 视图
    setActiveView,
    getActiveView,

    // 组
    createGroup,
    updateGroup,
    removeGroup,
    listGroups,
    groupsOfLine,

    // 调整
    adjustLineStart,
    adjustLineEnd,
    clearLineAdjust,
    adjustGroupStart,
    adjustGroupEnd,
    clearGroupAdjust,
    timeDiff,
    isLineAdjusted,

    // 更新
    updateLine,
    bumpLine,

    // 时间驱动
    tick,
    attachClock,

    // 订阅
    getState,
    subscribe
  };
}