import { SubtitleSession, SubtitleSessionState } from './types';

/**
 * 将 SubtitleSession 的关键状态同步到外部 Zustand store
 * - 适合保留 legacy 组件仍然从 store 读取 state（如 currentSentence）
 * - set：Zustand 的 set 函数（例如 usePlayerController.setState）
 *
 * 默认同步：
 * - activeLineId -> currentLineId
 * - activeViewRange -> activeViewRange
 * - 可按需拓展映射（例如 currentSentence）
 */
export function bindSessionToZustand<T>(
  session: SubtitleSession<T>,
  set: (partial: any) => void,
  options?: {
    /**
     * 是否将 activeLineId 对应的行对象写入 currentSentence 字段（兼容已有字段）
     */
    mapCurrentSentence?: boolean;
    /**
     * 自定义映射函数（可完全自定义如何将状态同步到 store）
     */
    projector?: (s: SubtitleSessionState, getLine: (id: string) => T | null) => any;
  }
) {
  const unActive = session.subscribe(
    s => s.activeLineId,
    (next) => {
      const patch: any = { currentLineId: next };
      if (options?.mapCurrentSentence) {
        patch.currentSentence = next ? session.getLine(next) : null;
      }
      if (!options?.projector) {
        set(patch);
      }
    }
  );

  const unRange = session.subscribe(
    s => s.activeViewRange,
    (next) => {
      if (!options?.projector) {
        set({ activeViewRange: next });
      }
    }
  );

  // 自定义整体 projector（若提供，则覆盖上面默认映射）
  let unProjector: (() => void) | null = null;
  if (options?.projector) {
    unActive();
    unRange();
    unProjector = session.subscribe(
      s => s,
      (next) => set(options.projector!(next, session.getLine))
    );
  }

  return () => {
    if (unProjector) unProjector();
    else {
      unActive();
      unRange();
    }
  };
}